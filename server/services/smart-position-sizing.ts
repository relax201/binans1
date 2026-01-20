import type { BotSettings } from "@shared/schema";
import { binanceService } from "./binance";

interface ATRResult {
  atr: number;
  atrPercent: number;
  volatilityLevel: 'low' | 'medium' | 'high' | 'extreme';
}

interface PositionSizeResult {
  recommendedSize: number;
  sizePercent: number;
  riskAmount: number;
  stopLossDistance: number;
  atr: ATRResult;
  adjustmentReason: string[];
}

export class SmartPositionSizing {
  private settings: BotSettings | null = null;

  updateSettings(settings: BotSettings) {
    this.settings = settings;
  }

  async calculateATR(symbol: string, period: number = 14): Promise<ATRResult> {
    try {
      const candles = await binanceService.getKlinesOHLCV(symbol, '1h', period + 1);
      
      if (candles.length < period + 1) {
        return { atr: 0, atrPercent: 0, volatilityLevel: 'medium' };
      }

      let trSum = 0;
      for (let i = 1; i < candles.length; i++) {
        const high = candles[i].high;
        const low = candles[i].low;
        const prevClose = candles[i - 1].close;
        
        const tr = Math.max(
          high - low,
          Math.abs(high - prevClose),
          Math.abs(low - prevClose)
        );
        trSum += tr;
      }

      const atr = trSum / period;
      const currentPrice = candles[candles.length - 1].close;
      const atrPercent = (atr / currentPrice) * 100;

      let volatilityLevel: 'low' | 'medium' | 'high' | 'extreme';
      if (atrPercent < 1) {
        volatilityLevel = 'low';
      } else if (atrPercent < 2.5) {
        volatilityLevel = 'medium';
      } else if (atrPercent < 5) {
        volatilityLevel = 'high';
      } else {
        volatilityLevel = 'extreme';
      }

      return { atr, atrPercent, volatilityLevel };
    } catch (error) {
      console.error(`Error calculating ATR for ${symbol}:`, error);
      return { atr: 0, atrPercent: 0, volatilityLevel: 'medium' };
    }
  }

  async calculateOptimalPositionSize(
    symbol: string,
    entryPrice: number,
    stopLossPrice: number,
    signalStrength: number = 70
  ): Promise<PositionSizeResult> {
    const adjustmentReason: string[] = [];
    
    if (!this.settings) {
      return {
        recommendedSize: 0,
        sizePercent: 0,
        riskAmount: 0,
        stopLossDistance: 0,
        atr: { atr: 0, atrPercent: 0, volatilityLevel: 'medium' },
        adjustmentReason: ['No settings available']
      };
    }

    try {
      const accountInfo = await binanceService.getAccountInfo();
      if (!accountInfo) {
        return {
          recommendedSize: 0,
          sizePercent: 0,
          riskAmount: 0,
          stopLossDistance: 0,
          atr: { atr: 0, atrPercent: 0, volatilityLevel: 'medium' },
          adjustmentReason: ['Could not get account info']
        };
      }
      const balance = accountInfo.totalBalance;
      
      const atrPeriod = this.settings.atrPeriod || 14;
      const atrResult = await this.calculateATR(symbol, atrPeriod);
      
      const maxRiskPercent = this.settings.maxRiskPerTrade || 2;
      let riskPercent = maxRiskPercent;

      if (this.settings.volatilityAdjustment) {
        switch (atrResult.volatilityLevel) {
          case 'low':
            riskPercent = maxRiskPercent * 1.2;
            adjustmentReason.push('زيادة الحجم بسبب انخفاض التقلب');
            break;
          case 'medium':
            break;
          case 'high':
            riskPercent = maxRiskPercent * 0.7;
            adjustmentReason.push('تقليل الحجم بسبب ارتفاع التقلب');
            break;
          case 'extreme':
            riskPercent = maxRiskPercent * 0.4;
            adjustmentReason.push('تقليل كبير بسبب التقلب الشديد');
            break;
        }
      }

      if (signalStrength >= 85) {
        riskPercent *= 1.15;
        adjustmentReason.push('زيادة الحجم بسبب قوة الإشارة العالية');
      } else if (signalStrength < 60) {
        riskPercent *= 0.7;
        adjustmentReason.push('تقليل الحجم بسبب ضعف الإشارة');
      }

      const riskAmount = balance * (riskPercent / 100);
      const stopLossDistance = Math.abs(entryPrice - stopLossPrice);
      const stopLossPercent = (stopLossDistance / entryPrice) * 100;

      let positionSize = riskAmount / stopLossDistance;
      let sizePercent = (positionSize * entryPrice / balance) * 100;

      const maxPositionPercent = this.settings.maxPositionPercent || 10;
      const minPositionPercent = this.settings.minPositionPercent || 1;

      if (sizePercent > maxPositionPercent) {
        sizePercent = maxPositionPercent;
        positionSize = (balance * (sizePercent / 100)) / entryPrice;
        adjustmentReason.push(`تم تحديد الحجم بالحد الأقصى ${maxPositionPercent}%`);
      }

      if (sizePercent < minPositionPercent) {
        sizePercent = minPositionPercent;
        positionSize = (balance * (sizePercent / 100)) / entryPrice;
        adjustmentReason.push(`تم رفع الحجم للحد الأدنى ${minPositionPercent}%`);
      }

      return {
        recommendedSize: Math.floor(positionSize * 1000) / 1000,
        sizePercent: Math.round(sizePercent * 100) / 100,
        riskAmount: Math.round(riskAmount * 100) / 100,
        stopLossDistance,
        atr: atrResult,
        adjustmentReason
      };
    } catch (error) {
      console.error(`Error calculating position size for ${symbol}:`, error);
      return {
        recommendedSize: 0,
        sizePercent: 0,
        riskAmount: 0,
        stopLossDistance: 0,
        atr: { atr: 0, atrPercent: 0, volatilityLevel: 'medium' },
        adjustmentReason: ['Error calculating position size']
      };
    }
  }

  calculateATRBasedStopLoss(
    entryPrice: number,
    atr: number,
    atrMultiplier: number = 1.5,
    isLong: boolean = true
  ): number {
    const stopDistance = atr * atrMultiplier;
    if (isLong) {
      return entryPrice - stopDistance;
    } else {
      return entryPrice + stopDistance;
    }
  }

  calculateATRBasedTakeProfit(
    entryPrice: number,
    atr: number,
    riskRewardRatio: number = 1.5,
    atrMultiplier: number = 1.5,
    isLong: boolean = true
  ): number {
    const stopDistance = atr * atrMultiplier;
    const profitDistance = stopDistance * riskRewardRatio;
    if (isLong) {
      return entryPrice + profitDistance;
    } else {
      return entryPrice - profitDistance;
    }
  }
}

export const smartPositionSizing = new SmartPositionSizing();
