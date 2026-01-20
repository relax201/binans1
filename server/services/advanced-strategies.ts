import type { CandleData } from './technical-indicators';

export type StrategyType = 
  | 'breakout'      // اختراق الدعم/المقاومة
  | 'scalping'      // صفقات سريعة
  | 'momentum'      // متابعة الزخم
  | 'meanReversion' // العودة للمتوسط
  | 'gridTrading'   // شبكة التداول
  | 'swing';        // التداول المتأرجح

export interface StrategySignal {
  strategy: StrategyType;
  signal: 'buy' | 'sell' | 'hold';
  strength: number;
  confidence: number;
  reason: string;
  levels?: {
    entry: number;
    stopLoss: number;
    takeProfit: number;
  };
}

export interface SupportResistance {
  supports: number[];
  resistances: number[];
  currentPrice: number;
  nearestSupport: number | null;
  nearestResistance: number | null;
}

export interface StrategyConfig {
  breakout: {
    lookbackPeriod: number;
    breakoutThreshold: number;
    volumeMultiplier: number;
  };
  scalping: {
    profitTarget: number;
    stopLoss: number;
    maxHoldingPeriod: number;
  };
  momentum: {
    lookbackPeriod: number;
    momentumThreshold: number;
    trendStrength: number;
  };
  meanReversion: {
    bollingerPeriod: number;
    bollingerStdDev: number;
    oversoldLevel: number;
    overboughtLevel: number;
  };
  gridTrading: {
    gridLevels: number;
    gridSpacing: number;
    orderSize: number;
  };
  swing: {
    swingPeriod: number;
    minSwingSize: number;
    confirmationCandles: number;
  };
}

export class AdvancedStrategies {
  private config: StrategyConfig;

  constructor(config?: Partial<StrategyConfig>) {
    this.config = {
      breakout: {
        lookbackPeriod: config?.breakout?.lookbackPeriod || 20,
        breakoutThreshold: config?.breakout?.breakoutThreshold || 1.5,
        volumeMultiplier: config?.breakout?.volumeMultiplier || 1.5,
      },
      scalping: {
        profitTarget: config?.scalping?.profitTarget || 0.5,
        stopLoss: config?.scalping?.stopLoss || 0.3,
        maxHoldingPeriod: config?.scalping?.maxHoldingPeriod || 15,
      },
      momentum: {
        lookbackPeriod: config?.momentum?.lookbackPeriod || 14,
        momentumThreshold: config?.momentum?.momentumThreshold || 2,
        trendStrength: config?.momentum?.trendStrength || 60,
      },
      meanReversion: {
        bollingerPeriod: config?.meanReversion?.bollingerPeriod || 20,
        bollingerStdDev: config?.meanReversion?.bollingerStdDev || 2,
        oversoldLevel: config?.meanReversion?.oversoldLevel || 20,
        overboughtLevel: config?.meanReversion?.overboughtLevel || 80,
      },
      gridTrading: {
        gridLevels: config?.gridTrading?.gridLevels || 5,
        gridSpacing: config?.gridTrading?.gridSpacing || 1,
        orderSize: config?.gridTrading?.orderSize || 10,
      },
      swing: {
        swingPeriod: config?.swing?.swingPeriod || 10,
        minSwingSize: config?.swing?.minSwingSize || 2,
        confirmationCandles: config?.swing?.confirmationCandles || 3,
      },
    };
  }

  calculateSupportResistance(candles: CandleData[]): SupportResistance {
    if (candles.length < 20) {
      return {
        supports: [],
        resistances: [],
        currentPrice: candles[candles.length - 1]?.close || 0,
        nearestSupport: null,
        nearestResistance: null,
      };
    }

    const pivotPoints: { price: number; type: 'high' | 'low' }[] = [];
    const lookback = 5;

    for (let i = lookback; i < candles.length - lookback; i++) {
      let isHigh = true;
      let isLow = true;

      for (let j = 1; j <= lookback; j++) {
        if (candles[i].high <= candles[i - j].high || candles[i].high <= candles[i + j].high) {
          isHigh = false;
        }
        if (candles[i].low >= candles[i - j].low || candles[i].low >= candles[i + j].low) {
          isLow = false;
        }
      }

      if (isHigh) {
        pivotPoints.push({ price: candles[i].high, type: 'high' });
      }
      if (isLow) {
        pivotPoints.push({ price: candles[i].low, type: 'low' });
      }
    }

    const clusterThreshold = 0.005;
    const resistances: number[] = [];
    const supports: number[] = [];

    const highs = pivotPoints.filter(p => p.type === 'high').map(p => p.price);
    const lows = pivotPoints.filter(p => p.type === 'low').map(p => p.price);

    const clusterPrices = (prices: number[]): number[] => {
      if (prices.length === 0) return [];
      prices.sort((a, b) => a - b);
      const clusters: number[][] = [];
      let currentCluster: number[] = [prices[0]];

      for (let i = 1; i < prices.length; i++) {
        if ((prices[i] - prices[i - 1]) / prices[i - 1] < clusterThreshold) {
          currentCluster.push(prices[i]);
        } else {
          clusters.push(currentCluster);
          currentCluster = [prices[i]];
        }
      }
      clusters.push(currentCluster);

      return clusters
        .filter(c => c.length >= 2)
        .map(c => c.reduce((a, b) => a + b, 0) / c.length)
        .slice(-5);
    };

    resistances.push(...clusterPrices(highs));
    supports.push(...clusterPrices(lows));

    const currentPrice = candles[candles.length - 1].close;
    const nearestResistance = resistances.filter(r => r > currentPrice).sort((a, b) => a - b)[0] || null;
    const nearestSupport = supports.filter(s => s < currentPrice).sort((a, b) => b - a)[0] || null;

    return {
      supports: supports.sort((a, b) => b - a),
      resistances: resistances.sort((a, b) => a - b),
      currentPrice,
      nearestSupport,
      nearestResistance,
    };
  }

  calculateATR(candles: CandleData[], period: number = 14): number {
    if (candles.length < period + 1) return 0;

    const trueRanges: number[] = [];
    for (let i = 1; i < candles.length; i++) {
      const high = candles[i].high;
      const low = candles[i].low;
      const prevClose = candles[i - 1].close;
      const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
      trueRanges.push(tr);
    }

    const recentTRs = trueRanges.slice(-period);
    return recentTRs.reduce((a, b) => a + b, 0) / recentTRs.length;
  }

  calculateBollingerBands(prices: number[], period: number = 20, stdDev: number = 2): {
    upper: number;
    middle: number;
    lower: number;
    percentB: number;
  } {
    if (prices.length < period) {
      return { upper: 0, middle: 0, lower: 0, percentB: 0.5 };
    }

    const recentPrices = prices.slice(-period);
    const sma = recentPrices.reduce((a, b) => a + b, 0) / period;
    const variance = recentPrices.reduce((sum, val) => sum + Math.pow(val - sma, 2), 0) / period;
    const std = Math.sqrt(variance);

    const upper = sma + stdDev * std;
    const lower = sma - stdDev * std;
    const currentPrice = prices[prices.length - 1];
    const percentB = (currentPrice - lower) / (upper - lower);

    return { upper, middle: sma, lower, percentB };
  }

  calculateMomentum(prices: number[], period: number = 14): number {
    if (prices.length < period + 1) return 0;
    const currentPrice = prices[prices.length - 1];
    const pastPrice = prices[prices.length - 1 - period];
    return ((currentPrice - pastPrice) / pastPrice) * 100;
  }

  calculateADX(candles: CandleData[], period: number = 14): {
    adx: number;
    plusDI: number;
    minusDI: number;
    trend: 'strong' | 'moderate' | 'weak' | 'none';
  } {
    if (candles.length < period * 2) {
      return { adx: 0, plusDI: 0, minusDI: 0, trend: 'none' };
    }

    const plusDM: number[] = [];
    const minusDM: number[] = [];
    const tr: number[] = [];

    for (let i = 1; i < candles.length; i++) {
      const highDiff = candles[i].high - candles[i - 1].high;
      const lowDiff = candles[i - 1].low - candles[i].low;

      plusDM.push(highDiff > lowDiff && highDiff > 0 ? highDiff : 0);
      minusDM.push(lowDiff > highDiff && lowDiff > 0 ? lowDiff : 0);

      const high = candles[i].high;
      const low = candles[i].low;
      const prevClose = candles[i - 1].close;
      tr.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
    }

    const smoothedTR = this.smoothData(tr, period);
    const smoothedPlusDM = this.smoothData(plusDM, period);
    const smoothedMinusDM = this.smoothData(minusDM, period);

    if (smoothedTR.length === 0) {
      return { adx: 0, plusDI: 0, minusDI: 0, trend: 'none' };
    }

    const plusDI = (smoothedPlusDM[smoothedPlusDM.length - 1] / smoothedTR[smoothedTR.length - 1]) * 100;
    const minusDI = (smoothedMinusDM[smoothedMinusDM.length - 1] / smoothedTR[smoothedTR.length - 1]) * 100;

    const dx: number[] = [];
    for (let i = 0; i < smoothedPlusDM.length; i++) {
      const pdi = (smoothedPlusDM[i] / smoothedTR[i]) * 100;
      const mdi = (smoothedMinusDM[i] / smoothedTR[i]) * 100;
      dx.push(Math.abs(pdi - mdi) / (pdi + mdi) * 100 || 0);
    }

    const adx = dx.slice(-period).reduce((a, b) => a + b, 0) / period;

    let trend: 'strong' | 'moderate' | 'weak' | 'none' = 'none';
    if (adx >= 50) trend = 'strong';
    else if (adx >= 25) trend = 'moderate';
    else if (adx >= 15) trend = 'weak';

    return { adx, plusDI, minusDI, trend };
  }

  private smoothData(data: number[], period: number): number[] {
    if (data.length < period) return [];
    const result: number[] = [];
    let sum = data.slice(0, period).reduce((a, b) => a + b, 0);
    result.push(sum);

    for (let i = period; i < data.length; i++) {
      sum = sum - sum / period + data[i];
      result.push(sum);
    }
    return result;
  }

  analyzeBreakout(candles: CandleData[]): StrategySignal {
    const sr = this.calculateSupportResistance(candles);
    const currentPrice = sr.currentPrice;
    const atr = this.calculateATR(candles);
    const avgVolume = candles.slice(-20).reduce((a, c) => a + c.volume, 0) / 20;
    const currentVolume = candles[candles.length - 1].volume;
    const volumeRatio = currentVolume / avgVolume;

    let signal: 'buy' | 'sell' | 'hold' = 'hold';
    let strength = 0;
    let confidence = 0;
    let reason = 'لا توجد إشارة اختراق';

    if (sr.nearestResistance) {
      const distanceToResistance = (sr.nearestResistance - currentPrice) / currentPrice * 100;
      if (distanceToResistance < 0.5 && distanceToResistance > -1.5) {
        if (currentPrice > sr.nearestResistance && volumeRatio > this.config.breakout.volumeMultiplier) {
          signal = 'buy';
          strength = Math.min(90, 60 + volumeRatio * 10);
          confidence = Math.min(85, 50 + volumeRatio * 15);
          reason = `اختراق مقاومة ${sr.nearestResistance.toFixed(2)} بحجم تداول مرتفع (${volumeRatio.toFixed(1)}x)`;
        }
      }
    }

    if (sr.nearestSupport && signal === 'hold') {
      const distanceToSupport = (currentPrice - sr.nearestSupport) / currentPrice * 100;
      if (distanceToSupport < 0.5 && distanceToSupport > -1.5) {
        if (currentPrice < sr.nearestSupport && volumeRatio > this.config.breakout.volumeMultiplier) {
          signal = 'sell';
          strength = Math.min(90, 60 + volumeRatio * 10);
          confidence = Math.min(85, 50 + volumeRatio * 15);
          reason = `كسر دعم ${sr.nearestSupport.toFixed(2)} بحجم تداول مرتفع (${volumeRatio.toFixed(1)}x)`;
        }
      }
    }

    return {
      strategy: 'breakout',
      signal,
      strength,
      confidence,
      reason,
      levels: signal !== 'hold' ? {
        entry: currentPrice,
        stopLoss: signal === 'buy' 
          ? (sr.nearestSupport || currentPrice * 0.98) 
          : (sr.nearestResistance || currentPrice * 1.02),
        takeProfit: signal === 'buy'
          ? currentPrice + atr * 2
          : currentPrice - atr * 2,
      } : undefined,
    };
  }

  analyzeScalping(candles: CandleData[]): StrategySignal {
    if (candles.length < 20) {
      return { strategy: 'scalping', signal: 'hold', strength: 0, confidence: 0, reason: 'بيانات غير كافية' };
    }

    const prices = candles.map(c => c.close);
    const ema9 = this.calculateEMA(prices, 9);
    const ema21 = this.calculateEMA(prices, 21);
    const currentPrice = prices[prices.length - 1];
    const atr = this.calculateATR(candles, 10);
    
    const rsi = this.calculateRSI(prices, 7);
    const stochastic = this.calculateStochastic(candles, 5, 3);

    let signal: 'buy' | 'sell' | 'hold' = 'hold';
    let strength = 0;
    let confidence = 0;
    let reason = 'لا توجد فرصة سكالبينج';

    const emaSignal = ema9[ema9.length - 1] > ema21[ema21.length - 1] ? 'buy' : 'sell';
    const previousEmaSignal = ema9[ema9.length - 2] > ema21[ema21.length - 2] ? 'buy' : 'sell';
    const emaCrossover = emaSignal !== previousEmaSignal;

    if (emaCrossover && emaSignal === 'buy' && rsi < 70 && stochastic.k < 80) {
      signal = 'buy';
      strength = 70 + (80 - stochastic.k) / 4;
      confidence = 65;
      reason = `تقاطع EMA صعودي + RSI(${rsi.toFixed(0)}) + Stoch(${stochastic.k.toFixed(0)})`;
    } else if (emaCrossover && emaSignal === 'sell' && rsi > 30 && stochastic.k > 20) {
      signal = 'sell';
      strength = 70 + (stochastic.k - 20) / 4;
      confidence = 65;
      reason = `تقاطع EMA هبوطي + RSI(${rsi.toFixed(0)}) + Stoch(${stochastic.k.toFixed(0)})`;
    }

    return {
      strategy: 'scalping',
      signal,
      strength: Math.min(strength, 90),
      confidence: Math.min(confidence, 85),
      reason,
      levels: signal !== 'hold' ? {
        entry: currentPrice,
        stopLoss: signal === 'buy' 
          ? currentPrice - atr * 1.5 
          : currentPrice + atr * 1.5,
        takeProfit: signal === 'buy'
          ? currentPrice + atr * 2
          : currentPrice - atr * 2,
      } : undefined,
    };
  }

  analyzeMomentum(candles: CandleData[]): StrategySignal {
    if (candles.length < 30) {
      return { strategy: 'momentum', signal: 'hold', strength: 0, confidence: 0, reason: 'بيانات غير كافية' };
    }

    const prices = candles.map(c => c.close);
    const currentPrice = prices[prices.length - 1];
    const momentum = this.calculateMomentum(prices, this.config.momentum.lookbackPeriod);
    const adx = this.calculateADX(candles, 14);
    const roc = ((currentPrice - prices[prices.length - 10]) / prices[prices.length - 10]) * 100;
    const atr = this.calculateATR(candles);

    let signal: 'buy' | 'sell' | 'hold' = 'hold';
    let strength = 0;
    let confidence = 0;
    let reason = 'لا يوجد زخم كافي';

    const trendStrength = adx.trend;
    const isTrending = trendStrength === 'strong' || trendStrength === 'moderate';

    if (momentum > this.config.momentum.momentumThreshold && isTrending && adx.plusDI > adx.minusDI) {
      signal = 'buy';
      strength = Math.min(90, 50 + momentum * 5 + adx.adx);
      confidence = Math.min(85, 40 + adx.adx);
      reason = `زخم صعودي قوي (${momentum.toFixed(1)}%) + ADX(${adx.adx.toFixed(0)}) + اتجاه ${trendStrength === 'strong' ? 'قوي' : 'متوسط'}`;
    } else if (momentum < -this.config.momentum.momentumThreshold && isTrending && adx.minusDI > adx.plusDI) {
      signal = 'sell';
      strength = Math.min(90, 50 + Math.abs(momentum) * 5 + adx.adx);
      confidence = Math.min(85, 40 + adx.adx);
      reason = `زخم هبوطي قوي (${momentum.toFixed(1)}%) + ADX(${adx.adx.toFixed(0)}) + اتجاه ${trendStrength === 'strong' ? 'قوي' : 'متوسط'}`;
    }

    return {
      strategy: 'momentum',
      signal,
      strength,
      confidence,
      reason,
      levels: signal !== 'hold' ? {
        entry: currentPrice,
        stopLoss: signal === 'buy' 
          ? currentPrice - atr * 2 
          : currentPrice + atr * 2,
        takeProfit: signal === 'buy'
          ? currentPrice + atr * 3
          : currentPrice - atr * 3,
      } : undefined,
    };
  }

  analyzeMeanReversion(candles: CandleData[]): StrategySignal {
    if (candles.length < 30) {
      return { strategy: 'meanReversion', signal: 'hold', strength: 0, confidence: 0, reason: 'بيانات غير كافية' };
    }

    const prices = candles.map(c => c.close);
    const currentPrice = prices[prices.length - 1];
    const bb = this.calculateBollingerBands(prices, this.config.meanReversion.bollingerPeriod, this.config.meanReversion.bollingerStdDev);
    const rsi = this.calculateRSI(prices, 14);
    const atr = this.calculateATR(candles);

    let signal: 'buy' | 'sell' | 'hold' = 'hold';
    let strength = 0;
    let confidence = 0;
    let reason = 'السعر ضمن النطاق الطبيعي';

    const isOversold = bb.percentB < 0.1 && rsi < this.config.meanReversion.oversoldLevel;
    const isOverbought = bb.percentB > 0.9 && rsi > this.config.meanReversion.overboughtLevel;

    if (isOversold) {
      signal = 'buy';
      strength = Math.min(90, 60 + (this.config.meanReversion.oversoldLevel - rsi) * 2);
      confidence = Math.min(80, 50 + (0.1 - bb.percentB) * 200);
      reason = `ذروة البيع: RSI(${rsi.toFixed(0)}) + BB%(${(bb.percentB * 100).toFixed(0)}%) - توقع ارتداد صعودي`;
    } else if (isOverbought) {
      signal = 'sell';
      strength = Math.min(90, 60 + (rsi - this.config.meanReversion.overboughtLevel) * 2);
      confidence = Math.min(80, 50 + (bb.percentB - 0.9) * 200);
      reason = `ذروة الشراء: RSI(${rsi.toFixed(0)}) + BB%(${(bb.percentB * 100).toFixed(0)}%) - توقع ارتداد هبوطي`;
    }

    return {
      strategy: 'meanReversion',
      signal,
      strength,
      confidence,
      reason,
      levels: signal !== 'hold' ? {
        entry: currentPrice,
        stopLoss: signal === 'buy' 
          ? bb.lower - atr * 0.5
          : bb.upper + atr * 0.5,
        takeProfit: bb.middle,
      } : undefined,
    };
  }

  analyzeSwing(candles: CandleData[]): StrategySignal {
    if (candles.length < 50) {
      return { strategy: 'swing', signal: 'hold', strength: 0, confidence: 0, reason: 'بيانات غير كافية' };
    }

    const prices = candles.map(c => c.close);
    const currentPrice = prices[prices.length - 1];
    const sr = this.calculateSupportResistance(candles);
    const adx = this.calculateADX(candles, 14);
    const atr = this.calculateATR(candles);

    const swingHighs: number[] = [];
    const swingLows: number[] = [];
    const period = this.config.swing.swingPeriod;

    for (let i = period; i < candles.length - period; i++) {
      let isHigh = true;
      let isLow = true;
      for (let j = 1; j <= period; j++) {
        if (candles[i].high < candles[i - j].high || candles[i].high < candles[i + j].high) isHigh = false;
        if (candles[i].low > candles[i - j].low || candles[i].low > candles[i + j].low) isLow = false;
      }
      if (isHigh) swingHighs.push(candles[i].high);
      if (isLow) swingLows.push(candles[i].low);
    }

    let signal: 'buy' | 'sell' | 'hold' = 'hold';
    let strength = 0;
    let confidence = 0;
    let reason = 'لا توجد نقطة دخول سوينغ';

    const recentLow = swingLows.length > 0 ? swingLows[swingLows.length - 1] : null;
    const recentHigh = swingHighs.length > 0 ? swingHighs[swingHighs.length - 1] : null;

    if (recentLow && sr.nearestSupport) {
      const distanceToSupport = (currentPrice - sr.nearestSupport) / sr.nearestSupport * 100;
      if (distanceToSupport < 2 && distanceToSupport > 0 && adx.plusDI > adx.minusDI) {
        signal = 'buy';
        strength = Math.min(85, 50 + (2 - distanceToSupport) * 20);
        confidence = Math.min(80, 45 + adx.adx);
        reason = `ارتداد من دعم سوينغ ${sr.nearestSupport.toFixed(2)} + ADX(${adx.adx.toFixed(0)})`;
      }
    }

    if (recentHigh && sr.nearestResistance && signal === 'hold') {
      const distanceToResistance = (sr.nearestResistance - currentPrice) / currentPrice * 100;
      if (distanceToResistance < 2 && distanceToResistance > 0 && adx.minusDI > adx.plusDI) {
        signal = 'sell';
        strength = Math.min(85, 50 + (2 - distanceToResistance) * 20);
        confidence = Math.min(80, 45 + adx.adx);
        reason = `ارتداد من مقاومة سوينغ ${sr.nearestResistance.toFixed(2)} + ADX(${adx.adx.toFixed(0)})`;
      }
    }

    return {
      strategy: 'swing',
      signal,
      strength,
      confidence,
      reason,
      levels: signal !== 'hold' ? {
        entry: currentPrice,
        stopLoss: signal === 'buy' 
          ? (sr.nearestSupport || currentPrice) - atr * 1.5
          : (sr.nearestResistance || currentPrice) + atr * 1.5,
        takeProfit: signal === 'buy'
          ? sr.nearestResistance || currentPrice + atr * 3
          : sr.nearestSupport || currentPrice - atr * 3,
      } : undefined,
    };
  }

  analyzeGridTrading(candles: CandleData[]): StrategySignal {
    const sr = this.calculateSupportResistance(candles);
    const currentPrice = sr.currentPrice;
    const atr = this.calculateATR(candles);
    const { gridLevels, gridSpacing } = this.config.gridTrading;

    const gridUpper = currentPrice * (1 + (gridSpacing * gridLevels) / 100);
    const gridLower = currentPrice * (1 - (gridSpacing * gridLevels) / 100);

    let signal: 'buy' | 'sell' | 'hold' = 'hold';
    let strength = 0;
    let confidence = 0;
    let reason = 'شبكة التداول جاهزة للتنفيذ';

    if (sr.nearestSupport && (currentPrice - sr.nearestSupport) / sr.nearestSupport * 100 < 1) {
      signal = 'buy';
      strength = 60;
      confidence = 55;
      reason = `قرب مستوى الشبكة السفلي - شراء عند الدعم ${sr.nearestSupport.toFixed(2)}`;
    } else if (sr.nearestResistance && (sr.nearestResistance - currentPrice) / currentPrice * 100 < 1) {
      signal = 'sell';
      strength = 60;
      confidence = 55;
      reason = `قرب مستوى الشبكة العلوي - بيع عند المقاومة ${sr.nearestResistance.toFixed(2)}`;
    }

    return {
      strategy: 'gridTrading',
      signal,
      strength,
      confidence,
      reason,
      levels: {
        entry: currentPrice,
        stopLoss: gridLower - atr,
        takeProfit: gridUpper + atr,
      },
    };
  }

  private calculateEMA(prices: number[], period: number): number[] {
    const ema: number[] = [];
    const multiplier = 2 / (period + 1);
    const firstSMA = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
    ema.push(firstSMA);
    for (let i = period; i < prices.length; i++) {
      ema.push((prices[i] - ema[ema.length - 1]) * multiplier + ema[ema.length - 1]);
    }
    return ema;
  }

  private calculateRSI(prices: number[], period: number = 14): number {
    if (prices.length < period + 1) return 50;
    const changes: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      changes.push(prices[i] - prices[i - 1]);
    }
    let avgGain = 0, avgLoss = 0;
    for (let i = 0; i < period; i++) {
      if (changes[i] > 0) avgGain += changes[i];
      else avgLoss += Math.abs(changes[i]);
    }
    avgGain /= period;
    avgLoss /= period;
    for (let i = period; i < changes.length; i++) {
      if (changes[i] > 0) {
        avgGain = (avgGain * (period - 1) + changes[i]) / period;
        avgLoss = (avgLoss * (period - 1)) / period;
      } else {
        avgGain = (avgGain * (period - 1)) / period;
        avgLoss = (avgLoss * (period - 1) + Math.abs(changes[i])) / period;
      }
    }
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  private calculateStochastic(candles: CandleData[], kPeriod: number = 14, dPeriod: number = 3): { k: number; d: number } {
    if (candles.length < kPeriod) return { k: 50, d: 50 };
    const kValues: number[] = [];
    for (let i = kPeriod - 1; i < candles.length; i++) {
      const slice = candles.slice(i - kPeriod + 1, i + 1);
      const highestHigh = Math.max(...slice.map(c => c.high));
      const lowestLow = Math.min(...slice.map(c => c.low));
      const close = candles[i].close;
      kValues.push(highestHigh === lowestLow ? 50 : ((close - lowestLow) / (highestHigh - lowestLow)) * 100);
    }
    const k = kValues[kValues.length - 1];
    const d = kValues.slice(-dPeriod).reduce((a, b) => a + b, 0) / dPeriod;
    return { k, d };
  }

  analyze(candles: CandleData[], enabledStrategies: StrategyType[] = ['breakout', 'momentum', 'meanReversion', 'swing']): {
    signals: StrategySignal[];
    bestSignal: StrategySignal | null;
    consensus: 'buy' | 'sell' | 'hold';
    consensusStrength: number;
  } {
    const signals: StrategySignal[] = [];

    if (enabledStrategies.includes('breakout')) {
      signals.push(this.analyzeBreakout(candles));
    }
    if (enabledStrategies.includes('scalping')) {
      signals.push(this.analyzeScalping(candles));
    }
    if (enabledStrategies.includes('momentum')) {
      signals.push(this.analyzeMomentum(candles));
    }
    if (enabledStrategies.includes('meanReversion')) {
      signals.push(this.analyzeMeanReversion(candles));
    }
    if (enabledStrategies.includes('swing')) {
      signals.push(this.analyzeSwing(candles));
    }
    if (enabledStrategies.includes('gridTrading')) {
      signals.push(this.analyzeGridTrading(candles));
    }

    const actionableSignals = signals.filter(s => s.signal !== 'hold' && s.confidence >= 50);
    const buySignals = actionableSignals.filter(s => s.signal === 'buy');
    const sellSignals = actionableSignals.filter(s => s.signal === 'sell');

    let consensus: 'buy' | 'sell' | 'hold' = 'hold';
    let consensusStrength = 0;

    if (buySignals.length > sellSignals.length && buySignals.length >= 2) {
      consensus = 'buy';
      consensusStrength = buySignals.reduce((sum, s) => sum + s.strength, 0) / buySignals.length;
    } else if (sellSignals.length > buySignals.length && sellSignals.length >= 2) {
      consensus = 'sell';
      consensusStrength = sellSignals.reduce((sum, s) => sum + s.strength, 0) / sellSignals.length;
    }

    const bestSignal = actionableSignals.length > 0
      ? actionableSignals.sort((a, b) => (b.strength * b.confidence) - (a.strength * a.confidence))[0]
      : null;

    return { signals, bestSignal, consensus, consensusStrength };
  }
}

export const advancedStrategies = new AdvancedStrategies();
