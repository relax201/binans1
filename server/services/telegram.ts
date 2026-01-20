import type { Trade, BotSettings } from "@shared/schema";

export interface TelegramMessage {
  chatId: string;
  text: string;
  parseMode?: 'HTML' | 'Markdown';
}

export class TelegramService {
  private botToken: string;
  private chatId: string;
  private baseUrl: string;

  constructor(settings?: BotSettings) {
    this.botToken = settings?.telegramBotToken || '';
    this.chatId = settings?.telegramChatId || '';
    this.baseUrl = `https://api.telegram.org/bot${this.botToken}`;
  }

  updateSettings(settings: BotSettings) {
    this.botToken = settings.telegramBotToken || '';
    this.chatId = settings.telegramChatId || '';
    this.baseUrl = `https://api.telegram.org/bot${this.botToken}`;
  }

  isConfigured(): boolean {
    return !!(this.botToken && this.chatId);
  }

  async sendMessage(text: string, parseMode: 'HTML' | 'Markdown' = 'HTML'): Promise<boolean> {
    if (!this.isConfigured()) {
      console.log('Telegram not configured, skipping notification');
      return false;
    }

    try {
      const response = await fetch(`${this.baseUrl}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: this.chatId,
          text,
          parse_mode: parseMode,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Telegram send failed:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Telegram error:', error);
      return false;
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.isConfigured()) {
      return false;
    }

    try {
      const response = await fetch(`${this.baseUrl}/getMe`);
      return response.ok;
    } catch (error) {
      console.error('Telegram connection test failed:', error);
      return false;
    }
  }

  formatTradeOpenMessage(trade: Trade, currentPrice: number): string {
    const isLong = trade.type === 'long';
    const direction = isLong ? '🟢 شراء (Long)' : '🔴 بيع (Short)';
    const autoLabel = trade.isAutoTrade ? '🤖 تلقائي' : '👤 يدوي';

    return `
<b>📈 صفقة جديدة ${autoLabel}</b>

${direction}
<b>الزوج:</b> ${trade.symbol}
<b>سعر الدخول:</b> $${trade.entryPrice.toFixed(2)}
<b>الكمية:</b> ${trade.quantity.toFixed(6)}
<b>الرافعة المالية:</b> ${trade.leverage}x

<b>وقف الخسارة:</b> $${trade.stopLoss.toFixed(2)}
<b>جني الأرباح:</b> $${trade.takeProfit.toFixed(2)}

<b>إشارات الدخول:</b> ${trade.entrySignals?.join(', ') || 'غير محدد'}
<b>الوقت:</b> ${new Date().toLocaleString('ar-SA')}
    `.trim();
  }

  formatTradeCloseMessage(trade: Trade): string {
    const isProfit = (trade.profit || 0) >= 0;
    const profitEmoji = isProfit ? '💰' : '📉';
    const profitText = isProfit ? 'ربح' : 'خسارة';

    return `
<b>${profitEmoji} إغلاق صفقة</b>

<b>الزوج:</b> ${trade.symbol}
<b>النوع:</b> ${trade.type === 'long' ? 'شراء' : 'بيع'}

<b>سعر الدخول:</b> $${trade.entryPrice.toFixed(2)}
<b>سعر الخروج:</b> $${(trade.exitPrice || 0).toFixed(2)}

<b>${profitText}:</b> ${isProfit ? '+' : ''}$${(trade.profit || 0).toFixed(2)} (${isProfit ? '+' : ''}${(trade.profitPercent || 0).toFixed(2)}%)

<b>الوقت:</b> ${new Date().toLocaleString('ar-SA')}
    `.trim();
  }

  formatSignalMessage(symbol: string, signal: 'buy' | 'sell' | 'hold', strength: number, indicators: string[]): string {
    const signalEmoji = signal === 'buy' ? '🟢' : signal === 'sell' ? '🔴' : '⚪';
    const signalText = signal === 'buy' ? 'شراء' : signal === 'sell' ? 'بيع' : 'انتظار';

    return `
<b>${signalEmoji} إشارة تداول قوية</b>

<b>الزوج:</b> ${symbol}
<b>الإشارة:</b> ${signalText}
<b>قوة الإشارة:</b> ${strength}%

<b>المؤشرات المؤكدة:</b>
${indicators.map(i => `• ${i}`).join('\n')}

<b>الوقت:</b> ${new Date().toLocaleString('ar-SA')}
    `.trim();
  }

  formatTrailingStopMessage(trade: Trade, newStopLoss: number): string {
    return `
<b>🔄 تحديث وقف الخسارة المتحرك</b>

<b>الزوج:</b> ${trade.symbol}
<b>سعر الدخول:</b> $${trade.entryPrice.toFixed(2)}
<b>وقف الخسارة الجديد:</b> $${newStopLoss.toFixed(2)}
<b>وقف الخسارة السابق:</b> $${trade.stopLoss.toFixed(2)}

<b>الوقت:</b> ${new Date().toLocaleString('ar-SA')}
    `.trim();
  }

  formatDailySummary(stats: {
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    totalProfit: number;
    bestTrade: number;
    worstTrade: number;
  }): string {
    const winRate = stats.totalTrades > 0 
      ? ((stats.winningTrades / stats.totalTrades) * 100).toFixed(1)
      : '0';

    return `
<b>📊 ملخص اليوم</b>

<b>إجمالي الصفقات:</b> ${stats.totalTrades}
<b>الصفقات الرابحة:</b> ${stats.winningTrades}
<b>الصفقات الخاسرة:</b> ${stats.losingTrades}
<b>نسبة النجاح:</b> ${winRate}%

<b>إجمالي الربح:</b> ${stats.totalProfit >= 0 ? '+' : ''}$${stats.totalProfit.toFixed(2)}
<b>أفضل صفقة:</b> +$${stats.bestTrade.toFixed(2)}
<b>أسوأ صفقة:</b> $${stats.worstTrade.toFixed(2)}

<b>التاريخ:</b> ${new Date().toLocaleDateString('ar-SA')}
    `.trim();
  }

  async notifyTradeOpen(trade: Trade, currentPrice: number): Promise<boolean> {
    const message = this.formatTradeOpenMessage(trade, currentPrice);
    return this.sendMessage(message);
  }

  async notifyTradeClose(trade: Trade): Promise<boolean> {
    const message = this.formatTradeCloseMessage(trade);
    return this.sendMessage(message);
  }

  async notifySignal(symbol: string, signal: 'buy' | 'sell' | 'hold', strength: number, indicators: string[]): Promise<boolean> {
    const message = this.formatSignalMessage(symbol, signal, strength, indicators);
    return this.sendMessage(message);
  }

  async notifyTrailingStopUpdate(trade: Trade, newStopLoss: number): Promise<boolean> {
    const message = this.formatTrailingStopMessage(trade, newStopLoss);
    return this.sendMessage(message);
  }

  async sendDailySummary(stats: {
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    totalProfit: number;
    bestTrade: number;
    worstTrade: number;
  }): Promise<boolean> {
    const message = this.formatDailySummary(stats);
    return this.sendMessage(message);
  }
}

export const telegramService = new TelegramService();
