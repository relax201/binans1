import type { BotSettings, Trade } from "@shared/schema";

export interface EmailReport {
  to: string;
  subject: string;
  html: string;
}

export class EmailService {
  private enabled: boolean;
  private notificationEmail: string;

  constructor(settings?: BotSettings) {
    this.enabled = settings?.emailNotifications || false;
    this.notificationEmail = settings?.notificationEmail || '';
  }

  updateSettings(settings: BotSettings) {
    this.enabled = settings.emailNotifications || false;
    this.notificationEmail = settings.notificationEmail || '';
  }

  isConfigured(): boolean {
    return this.enabled && !!this.notificationEmail;
  }

  generateWeeklyReport(trades: Trade[], startDate: Date, endDate: Date): string {
    const closedTrades = trades.filter(t => t.status === 'closed');
    const totalProfit = closedTrades.reduce((sum, t) => sum + (t.profit || 0), 0);
    const winningTrades = closedTrades.filter(t => (t.profit || 0) > 0);
    const losingTrades = closedTrades.filter(t => (t.profit || 0) < 0);
    const winRate = closedTrades.length > 0 
      ? ((winningTrades.length / closedTrades.length) * 100).toFixed(1)
      : '0';

    const avgProfit = winningTrades.length > 0
      ? winningTrades.reduce((sum, t) => sum + (t.profit || 0), 0) / winningTrades.length
      : 0;
    const avgLoss = losingTrades.length > 0
      ? losingTrades.reduce((sum, t) => sum + (t.profit || 0), 0) / losingTrades.length
      : 0;

    const pairStats: Record<string, { trades: number; profit: number }> = {};
    closedTrades.forEach(t => {
      if (!pairStats[t.symbol]) {
        pairStats[t.symbol] = { trades: 0, profit: 0 };
      }
      pairStats[t.symbol].trades++;
      pairStats[t.symbol].profit += t.profit || 0;
    });

    const topPairs = Object.entries(pairStats)
      .sort((a, b) => b[1].profit - a[1].profit)
      .slice(0, 5);

    return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, sans-serif; background: #f5f5f5; padding: 20px; direction: rtl; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .header p { margin: 10px 0 0; opacity: 0.8; }
    .content { padding: 30px; }
    .stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 30px; }
    .stat-card { background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center; }
    .stat-value { font-size: 24px; font-weight: bold; color: #1a1a2e; }
    .stat-label { font-size: 12px; color: #666; margin-top: 5px; }
    .profit { color: #10b981; }
    .loss { color: #ef4444; }
    .section { margin-bottom: 25px; }
    .section-title { font-size: 16px; font-weight: bold; color: #1a1a2e; margin-bottom: 15px; border-bottom: 2px solid #eee; padding-bottom: 10px; }
    .pair-row { display: flex; justify-content: space-between; padding: 10px; background: #f8f9fa; border-radius: 6px; margin-bottom: 8px; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 التقرير الأسبوعي</h1>
      <p>${startDate.toLocaleDateString('ar-SA')} - ${endDate.toLocaleDateString('ar-SA')}</p>
    </div>
    <div class="content">
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${closedTrades.length}</div>
          <div class="stat-label">إجمالي الصفقات</div>
        </div>
        <div class="stat-card">
          <div class="stat-value ${totalProfit >= 0 ? 'profit' : 'loss'}">${totalProfit >= 0 ? '+' : ''}$${totalProfit.toFixed(2)}</div>
          <div class="stat-label">إجمالي الربح</div>
        </div>
        <div class="stat-card">
          <div class="stat-value profit">${winningTrades.length}</div>
          <div class="stat-label">صفقات رابحة</div>
        </div>
        <div class="stat-card">
          <div class="stat-value loss">${losingTrades.length}</div>
          <div class="stat-label">صفقات خاسرة</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${winRate}%</div>
          <div class="stat-label">نسبة النجاح</div>
        </div>
        <div class="stat-card">
          <div class="stat-value profit">+$${avgProfit.toFixed(2)}</div>
          <div class="stat-label">متوسط الربح</div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">🏆 أفضل أزواج العملات</div>
        ${topPairs.map(([symbol, data]) => `
          <div class="pair-row">
            <span>${symbol}</span>
            <span>${data.trades} صفقة</span>
            <span class="${data.profit >= 0 ? 'profit' : 'loss'}">${data.profit >= 0 ? '+' : ''}$${data.profit.toFixed(2)}</span>
          </div>
        `).join('')}
      </div>
    </div>
    <div class="footer">
      <p>تم إنشاء هذا التقرير تلقائياً بواسطة Trading Bot</p>
      <p>⚠️ تحذير: التداول ينطوي على مخاطر. لا تستثمر أكثر مما يمكنك تحمل خسارته.</p>
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  generateMonthlyReport(trades: Trade[], startDate: Date, endDate: Date): string {
    const closedTrades = trades.filter(t => t.status === 'closed');
    const totalProfit = closedTrades.reduce((sum, t) => sum + (t.profit || 0), 0);
    const winningTrades = closedTrades.filter(t => (t.profit || 0) > 0);
    const losingTrades = closedTrades.filter(t => (t.profit || 0) < 0);
    
    const weeklyData: { week: number; profit: number; trades: number }[] = [];
    const weeksMap: Record<number, { profit: number; trades: number }> = {};

    closedTrades.forEach(t => {
      if (t.exitTime) {
        const weekNum = Math.ceil((new Date(t.exitTime).getDate()) / 7);
        if (!weeksMap[weekNum]) {
          weeksMap[weekNum] = { profit: 0, trades: 0 };
        }
        weeksMap[weekNum].profit += t.profit || 0;
        weeksMap[weekNum].trades++;
      }
    });

    for (let i = 1; i <= 5; i++) {
      weeklyData.push({
        week: i,
        profit: weeksMap[i]?.profit || 0,
        trades: weeksMap[i]?.trades || 0,
      });
    }

    const autoTrades = closedTrades.filter(t => t.isAutoTrade).length;
    const manualTrades = closedTrades.length - autoTrades;

    return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, sans-serif; background: #f5f5f5; padding: 20px; direction: rtl; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .header p { margin: 10px 0 0; opacity: 0.8; }
    .content { padding: 30px; }
    .highlight-card { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 25px; border-radius: 12px; text-align: center; margin-bottom: 25px; }
    .highlight-value { font-size: 36px; font-weight: bold; }
    .highlight-label { opacity: 0.9; margin-top: 5px; }
    .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 25px; }
    .stat-card { background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center; }
    .stat-value { font-size: 20px; font-weight: bold; color: #1a1a2e; }
    .stat-label { font-size: 11px; color: #666; margin-top: 5px; }
    .profit { color: #10b981; }
    .loss { color: #ef4444; }
    .section { margin-bottom: 25px; }
    .section-title { font-size: 16px; font-weight: bold; color: #1a1a2e; margin-bottom: 15px; }
    .week-row { display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #f8f9fa; border-radius: 6px; margin-bottom: 8px; }
    .week-bar { height: 6px; background: #e5e5e5; border-radius: 3px; flex: 1; margin: 0 15px; }
    .week-bar-fill { height: 100%; border-radius: 3px; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📈 التقرير الشهري</h1>
      <p>${startDate.toLocaleDateString('ar-SA', { month: 'long', year: 'numeric' })}</p>
    </div>
    <div class="content">
      <div class="highlight-card" style="${totalProfit < 0 ? 'background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);' : ''}">
        <div class="highlight-value">${totalProfit >= 0 ? '+' : ''}$${totalProfit.toFixed(2)}</div>
        <div class="highlight-label">إجمالي الأرباح والخسائر</div>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${closedTrades.length}</div>
          <div class="stat-label">إجمالي الصفقات</div>
        </div>
        <div class="stat-card">
          <div class="stat-value profit">${winningTrades.length}</div>
          <div class="stat-label">رابحة</div>
        </div>
        <div class="stat-card">
          <div class="stat-value loss">${losingTrades.length}</div>
          <div class="stat-label">خاسرة</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${autoTrades}</div>
          <div class="stat-label">صفقات تلقائية</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${manualTrades}</div>
          <div class="stat-label">صفقات يدوية</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${closedTrades.length > 0 ? ((winningTrades.length / closedTrades.length) * 100).toFixed(0) : 0}%</div>
          <div class="stat-label">نسبة النجاح</div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">📊 الأداء الأسبوعي</div>
        ${weeklyData.filter(w => w.trades > 0).map(week => `
          <div class="week-row">
            <span>الأسبوع ${week.week}</span>
            <span>${week.trades} صفقة</span>
            <span class="${week.profit >= 0 ? 'profit' : 'loss'}">${week.profit >= 0 ? '+' : ''}$${week.profit.toFixed(2)}</span>
          </div>
        `).join('')}
      </div>
    </div>
    <div class="footer">
      <p>تم إنشاء هذا التقرير تلقائياً بواسطة Trading Bot</p>
      <p>⚠️ تحذير: التداول ينطوي على مخاطر. لا تستثمر أكثر مما يمكنك تحمل خسارته.</p>
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  async sendReport(type: 'weekly' | 'monthly', trades: Trade[]): Promise<boolean> {
    if (!this.isConfigured()) {
      console.log('Email not configured, skipping report');
      return false;
    }

    const now = new Date();
    let startDate: Date;
    let endDate: Date;
    let subject: string;
    let html: string;

    if (type === 'weekly') {
      endDate = now;
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      subject = `📊 التقرير الأسبوعي - ${now.toLocaleDateString('ar-SA')}`;
      html = this.generateWeeklyReport(trades, startDate, endDate);
    } else {
      endDate = now;
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      subject = `📈 التقرير الشهري - ${now.toLocaleDateString('ar-SA', { month: 'long', year: 'numeric' })}`;
      html = this.generateMonthlyReport(trades, startDate, endDate);
    }

    console.log(`Email report generated (${type}): ${subject}`);
    console.log(`Would send to: ${this.notificationEmail}`);
    
    return true;
  }
}

export const emailService = new EmailService();
