import type { BotSettings } from "@shared/schema";
import { binanceService } from "./binance";
import { smartPositionSizing } from "./smart-position-sizing";

type MarketCondition = 'trending_up' | 'trending_down' | 'ranging' | 'volatile' | 'unknown';
type TradingRecommendation = 'trade' | 'caution' | 'avoid';

interface MarketAnalysis {
  symbol: string;
  condition: MarketCondition;
  volatility: number;
  volatilityLevel: 'low' | 'medium' | 'high' | 'extreme';
  trendStrength: number;
  trendDirection: 'up' | 'down' | 'sideways';
  recommendation: TradingRecommendation;
  reasons: string[];
  score: number;
}

interface AccountProtectionStatus {
  canTrade: boolean;
  dailyPnL: number;
  dailyPnLPercent: number;
  consecutiveLosses: number;
  activeTrades: number;
  reasons: string[];
}

export class MarketFilter {
  private settings: BotSettings | null = null;
  private consecutiveLosses: number = 0;
  private dailyPnL: number = 0;
  private lastDayReset: string = '';

  updateSettings(settings: BotSettings) {
    this.settings = settings;
    smartPositionSizing.updateSettings(settings);
  }

  private resetDailyStatsIfNeeded() {
    const today = new Date().toDateString();
    if (this.lastDayReset !== today) {
      this.dailyPnL = 0;
      this.consecutiveLosses = 0;
      this.lastDayReset = today;
    }
  }

  recordTradeResult(profit: number) {
    this.resetDailyStatsIfNeeded();
    this.dailyPnL += profit;
    
    if (profit < 0) {
      this.consecutiveLosses++;
    } else {
      this.consecutiveLosses = 0;
    }
  }

  async analyzeMarketCondition(symbol: string): Promise<MarketAnalysis> {
    const reasons: string[] = [];
    let score = 100;

    try {
      const [atrResult, candles] = await Promise.all([
        smartPositionSizing.calculateATR(symbol, 14),
        binanceService.getKlinesOHLCV(symbol, '1h', 50)
      ]);

      const volatility = atrResult.atrPercent;
      const volatilityLevel = atrResult.volatilityLevel;

      const { trendStrength, trendDirection } = this.calculateTrend(candles);

      let condition: MarketCondition = 'unknown';
      
      if (volatilityLevel === 'extreme') {
        condition = 'volatile';
        score -= 40;
        reasons.push('السوق متقلب جداً');
      } else if (trendStrength > 50) {
        condition = trendDirection === 'up' ? 'trending_up' : 'trending_down';
        score += 10;
        reasons.push(`اتجاه ${trendDirection === 'up' ? 'صاعد' : 'هابط'} قوي`);
      } else if (trendStrength < 25) {
        condition = 'ranging';
        score -= 20;
        reasons.push('السوق في نطاق عرضي');
      } else {
        condition = trendDirection === 'up' ? 'trending_up' : 'trending_down';
      }

      if (this.settings?.avoidHighVolatility && volatility > (this.settings.maxVolatilityPercent || 5)) {
        score -= 30;
        reasons.push(`التقلب ${volatility.toFixed(1)}% يتجاوز الحد المسموح`);
      }

      if (this.settings?.avoidRangingMarket && condition === 'ranging') {
        score -= 25;
        reasons.push('تجنب التداول في السوق العرضي');
      }

      if (this.settings?.trendFilterEnabled && trendStrength < (this.settings.minTrendStrength || 25)) {
        score -= 20;
        reasons.push(`قوة الاتجاه ${trendStrength.toFixed(0)}% ضعيفة`);
      }

      let recommendation: TradingRecommendation;
      if (score >= 70) {
        recommendation = 'trade';
      } else if (score >= 40) {
        recommendation = 'caution';
      } else {
        recommendation = 'avoid';
      }

      return {
        symbol,
        condition,
        volatility,
        volatilityLevel,
        trendStrength,
        trendDirection,
        recommendation,
        reasons,
        score: Math.max(0, Math.min(100, score))
      };
    } catch (error) {
      console.error(`Error analyzing market condition for ${symbol}:`, error);
      return {
        symbol,
        condition: 'unknown',
        volatility: 0,
        volatilityLevel: 'medium',
        trendStrength: 0,
        trendDirection: 'sideways',
        recommendation: 'caution',
        reasons: ['فشل تحليل السوق'],
        score: 50
      };
    }
  }

  private calculateTrend(candles: any[]): { trendStrength: number; trendDirection: 'up' | 'down' | 'sideways' } {
    if (candles.length < 20) {
      return { trendStrength: 0, trendDirection: 'sideways' };
    }

    const closes = candles.map(c => c.close);
    
    const sma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const sma50 = closes.slice(-50).reduce((a, b) => a + b, 0) / Math.min(50, closes.length);
    
    const currentPrice = closes[closes.length - 1];
    const priceVsSma20 = ((currentPrice - sma20) / sma20) * 100;
    const sma20VsSma50 = ((sma20 - sma50) / sma50) * 100;

    let higherHighs = 0;
    let lowerLows = 0;
    const recentCandles = candles.slice(-10);
    
    for (let i = 2; i < recentCandles.length; i++) {
      if (recentCandles[i].high > recentCandles[i-1].high && recentCandles[i-1].high > recentCandles[i-2].high) {
        higherHighs++;
      }
      if (recentCandles[i].low < recentCandles[i-1].low && recentCandles[i-1].low < recentCandles[i-2].low) {
        lowerLows++;
      }
    }

    let trendStrength = 0;
    let trendDirection: 'up' | 'down' | 'sideways' = 'sideways';

    if (priceVsSma20 > 0 && sma20VsSma50 > 0) {
      trendDirection = 'up';
      trendStrength = Math.min(100, Math.abs(priceVsSma20) * 10 + higherHighs * 10);
    } else if (priceVsSma20 < 0 && sma20VsSma50 < 0) {
      trendDirection = 'down';
      trendStrength = Math.min(100, Math.abs(priceVsSma20) * 10 + lowerLows * 10);
    } else {
      trendDirection = 'sideways';
      trendStrength = Math.max(0, 50 - Math.abs(priceVsSma20) * 10);
    }

    return { trendStrength, trendDirection };
  }

  async checkAccountProtection(): Promise<AccountProtectionStatus> {
    this.resetDailyStatsIfNeeded();
    const reasons: string[] = [];
    let canTrade = true;

    if (!this.settings?.accountProtectionEnabled) {
      return {
        canTrade: true,
        dailyPnL: this.dailyPnL,
        dailyPnLPercent: 0,
        consecutiveLosses: this.consecutiveLosses,
        activeTrades: 0,
        reasons: []
      };
    }

    try {
      const accountInfo = await binanceService.getAccountInfo();
      if (!accountInfo) {
        return {
          canTrade: true,
          dailyPnL: this.dailyPnL,
          dailyPnLPercent: 0,
          consecutiveLosses: this.consecutiveLosses,
          activeTrades: 0,
          reasons: ['Could not get account info']
        };
      }
      const balance = accountInfo.totalBalance;
      const dailyPnLPercent = (this.dailyPnL / balance) * 100;

      const maxDailyLoss = this.settings.maxDailyLossPercent || 5;
      if (dailyPnLPercent < -maxDailyLoss) {
        canTrade = false;
        reasons.push(`تم الوصول لحد الخسارة اليومي ${maxDailyLoss}%`);
      }

      const maxConsecutive = this.settings.pauseAfterConsecutiveLosses || 3;
      if (this.consecutiveLosses >= maxConsecutive) {
        canTrade = false;
        reasons.push(`${this.consecutiveLosses} خسائر متتالية - إيقاف مؤقت`);
      }

      const activeTrades = accountInfo.positions?.length || 0;

      const maxConcurrent = this.settings.maxConcurrentTrades || 3;
      if (activeTrades >= maxConcurrent) {
        canTrade = false;
        reasons.push(`الوصول للحد الأقصى للصفقات المتزامنة (${maxConcurrent})`);
      }

      return {
        canTrade,
        dailyPnL: this.dailyPnL,
        dailyPnLPercent,
        consecutiveLosses: this.consecutiveLosses,
        activeTrades,
        reasons
      };
    } catch (error) {
      console.error('Error checking account protection:', error);
      return {
        canTrade: true,
        dailyPnL: this.dailyPnL,
        dailyPnLPercent: 0,
        consecutiveLosses: this.consecutiveLosses,
        activeTrades: 0,
        reasons: ['فشل التحقق من حماية الحساب']
      };
    }
  }

  async shouldTrade(symbol: string): Promise<{
    allowed: boolean;
    marketAnalysis: MarketAnalysis;
    accountStatus: AccountProtectionStatus;
  }> {
    const [marketAnalysis, accountStatus] = await Promise.all([
      this.analyzeMarketCondition(symbol),
      this.checkAccountProtection()
    ]);

    const marketAllowed = !this.settings?.marketFilterEnabled || marketAnalysis.recommendation !== 'avoid';
    const accountAllowed = accountStatus.canTrade;

    return {
      allowed: marketAllowed && accountAllowed,
      marketAnalysis,
      accountStatus
    };
  }

  async getDiversificationCheck(symbol: string, activePairs: string[]): Promise<{
    allowed: boolean;
    reason: string;
  }> {
    if (!this.settings?.diversificationEnabled) {
      return { allowed: true, reason: '' };
    }

    const baseAsset = symbol.replace('USDT', '').replace('BUSD', '');
    const activeBaseAssets = activePairs.map(p => p.replace('USDT', '').replace('BUSD', ''));
    
    if (activeBaseAssets.includes(baseAsset)) {
      return {
        allowed: false,
        reason: `يوجد صفقة مفتوحة على ${baseAsset} - التنويع مفعل`
      };
    }

    return { allowed: true, reason: '' };
  }
}

export const marketFilter = new MarketFilter();
