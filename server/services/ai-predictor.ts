import type { CandleData } from './technical-indicators';

export interface AISignal {
  signal: 'buy' | 'sell' | 'hold';
  strength: number;
  confidence: number;
  description: string;
}

export interface PatternResult {
  pattern: string;
  signal: 'buy' | 'sell' | 'hold';
  strength: number;
  description: string;
}

export interface AIPrediction {
  overallSignal: 'buy' | 'sell' | 'hold';
  confidence: number;
  signalStrength: number;
  predictions: {
    patternRecognition: AISignal;
    momentumAnalysis: AISignal;
    volatilityAnalysis: AISignal;
    trendStrength: AISignal;
    priceAction: AISignal;
  };
  detectedPatterns: PatternResult[];
  marketRegime: 'trending_up' | 'trending_down' | 'ranging' | 'volatile';
  riskLevel: 'low' | 'medium' | 'high';
  shortTermPrediction: 'bullish' | 'bearish' | 'neutral';
  mediumTermPrediction: 'bullish' | 'bearish' | 'neutral';
}

export class AIPredictor {
  private lookbackPeriod: number;

  constructor(lookbackPeriod: number = 50) {
    this.lookbackPeriod = lookbackPeriod;
  }

  calculateATR(candles: CandleData[], period: number = 14): number[] {
    const atr: number[] = [];
    const trueRanges: number[] = [];

    for (let i = 1; i < candles.length; i++) {
      const high = candles[i].high;
      const low = candles[i].low;
      const prevClose = candles[i - 1].close;

      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      trueRanges.push(tr);
    }

    for (let i = period - 1; i < trueRanges.length; i++) {
      const sum = trueRanges.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      atr.push(sum / period);
    }

    return atr;
  }

  calculateBollingerBands(prices: number[], period: number = 20, stdDev: number = 2): {
    upper: number[];
    middle: number[];
    lower: number[];
    bandwidth: number[];
    percentB: number[];
  } {
    const middle: number[] = [];
    const upper: number[] = [];
    const lower: number[] = [];
    const bandwidth: number[] = [];
    const percentB: number[] = [];

    for (let i = period - 1; i < prices.length; i++) {
      const slice = prices.slice(i - period + 1, i + 1);
      const sma = slice.reduce((a, b) => a + b, 0) / period;
      const variance = slice.reduce((sum, val) => sum + Math.pow(val - sma, 2), 0) / period;
      const std = Math.sqrt(variance);

      middle.push(sma);
      upper.push(sma + stdDev * std);
      lower.push(sma - stdDev * std);
      
      const bw = ((sma + stdDev * std) - (sma - stdDev * std)) / sma * 100;
      bandwidth.push(bw);
      
      const pB = (prices[i] - (sma - stdDev * std)) / ((sma + stdDev * std) - (sma - stdDev * std));
      percentB.push(pB);
    }

    return { upper, middle, lower, bandwidth, percentB };
  }

  calculateStochastic(candles: CandleData[], kPeriod: number = 14, dPeriod: number = 3): {
    k: number[];
    d: number[];
  } {
    const k: number[] = [];
    const d: number[] = [];

    for (let i = kPeriod - 1; i < candles.length; i++) {
      const slice = candles.slice(i - kPeriod + 1, i + 1);
      const highestHigh = Math.max(...slice.map(c => c.high));
      const lowestLow = Math.min(...slice.map(c => c.low));
      const currentClose = candles[i].close;

      const kValue = highestHigh === lowestLow 
        ? 50 
        : ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;
      k.push(kValue);
    }

    for (let i = dPeriod - 1; i < k.length; i++) {
      const dValue = k.slice(i - dPeriod + 1, i + 1).reduce((a, b) => a + b, 0) / dPeriod;
      d.push(dValue);
    }

    return { k, d };
  }

  calculateMomentum(prices: number[], period: number = 10): number[] {
    const momentum: number[] = [];
    for (let i = period; i < prices.length; i++) {
      const mom = ((prices[i] - prices[i - period]) / prices[i - period]) * 100;
      momentum.push(mom);
    }
    return momentum;
  }

  calculateROC(prices: number[], period: number = 12): number[] {
    const roc: number[] = [];
    for (let i = period; i < prices.length; i++) {
      const rocValue = ((prices[i] - prices[i - period]) / prices[i - period]) * 100;
      roc.push(rocValue);
    }
    return roc;
  }

  detectDoubleTop(candles: CandleData[], tolerance: number = 0.02): PatternResult | null {
    if (candles.length < 20) return null;

    const recent = candles.slice(-20);
    const highs = recent.map(c => c.high);
    
    let peak1Index = -1;
    let peak1Value = 0;
    let peak2Index = -1;
    let peak2Value = 0;

    for (let i = 2; i < highs.length - 2; i++) {
      if (highs[i] > highs[i - 1] && highs[i] > highs[i - 2] &&
          highs[i] > highs[i + 1] && highs[i] > highs[i + 2]) {
        if (peak1Index === -1) {
          peak1Index = i;
          peak1Value = highs[i];
        } else if (i - peak1Index >= 3) {
          peak2Index = i;
          peak2Value = highs[i];
        }
      }
    }

    if (peak1Index !== -1 && peak2Index !== -1) {
      const priceDiff = Math.abs(peak1Value - peak2Value) / peak1Value;
      if (priceDiff < tolerance) {
        return {
          pattern: 'Double Top',
          signal: 'sell',
          strength: 70 + (1 - priceDiff / tolerance) * 30,
          description: 'نمط القمة المزدوجة - إشارة هبوطية'
        };
      }
    }

    return null;
  }

  detectDoubleBottom(candles: CandleData[], tolerance: number = 0.02): PatternResult | null {
    if (candles.length < 20) return null;

    const recent = candles.slice(-20);
    const lows = recent.map(c => c.low);
    
    let trough1Index = -1;
    let trough1Value = Infinity;
    let trough2Index = -1;
    let trough2Value = Infinity;

    for (let i = 2; i < lows.length - 2; i++) {
      if (lows[i] < lows[i - 1] && lows[i] < lows[i - 2] &&
          lows[i] < lows[i + 1] && lows[i] < lows[i + 2]) {
        if (trough1Index === -1) {
          trough1Index = i;
          trough1Value = lows[i];
        } else if (i - trough1Index >= 3) {
          trough2Index = i;
          trough2Value = lows[i];
        }
      }
    }

    if (trough1Index !== -1 && trough2Index !== -1) {
      const priceDiff = Math.abs(trough1Value - trough2Value) / trough1Value;
      if (priceDiff < tolerance) {
        return {
          pattern: 'Double Bottom',
          signal: 'buy',
          strength: 70 + (1 - priceDiff / tolerance) * 30,
          description: 'نمط القاع المزدوج - إشارة صعودية'
        };
      }
    }

    return null;
  }

  detectEngulfingPattern(candles: CandleData[]): PatternResult | null {
    if (candles.length < 3) return null;

    const prev = candles[candles.length - 2];
    const curr = candles[candles.length - 1];

    const prevBody = Math.abs(prev.close - prev.open);
    const currBody = Math.abs(curr.close - curr.open);

    if (prev.close < prev.open && curr.close > curr.open) {
      if (curr.open <= prev.close && curr.close >= prev.open && currBody > prevBody) {
        return {
          pattern: 'Bullish Engulfing',
          signal: 'buy',
          strength: 65 + (currBody / prevBody) * 10,
          description: 'نمط الابتلاع الصاعد - إشارة صعودية قوية'
        };
      }
    }

    if (prev.close > prev.open && curr.close < curr.open) {
      if (curr.open >= prev.close && curr.close <= prev.open && currBody > prevBody) {
        return {
          pattern: 'Bearish Engulfing',
          signal: 'sell',
          strength: 65 + (currBody / prevBody) * 10,
          description: 'نمط الابتلاع الهابط - إشارة هبوطية قوية'
        };
      }
    }

    return null;
  }

  detectHammer(candles: CandleData[]): PatternResult | null {
    if (candles.length < 5) return null;

    const curr = candles[candles.length - 1];
    const body = Math.abs(curr.close - curr.open);
    const upperShadow = curr.high - Math.max(curr.open, curr.close);
    const lowerShadow = Math.min(curr.open, curr.close) - curr.low;
    const totalRange = curr.high - curr.low;

    if (totalRange === 0) return null;

    const prevCandles = candles.slice(-5, -1);
    const isDowntrend = prevCandles[0].close > prevCandles[prevCandles.length - 1].close;

    if (isDowntrend && lowerShadow >= body * 2 && upperShadow <= body * 0.5) {
      return {
        pattern: 'Hammer',
        signal: 'buy',
        strength: 60 + (lowerShadow / body) * 5,
        description: 'نمط المطرقة - إشارة انعكاس صعودي'
      };
    }

    const isUptrend = prevCandles[0].close < prevCandles[prevCandles.length - 1].close;

    if (isUptrend && upperShadow >= body * 2 && lowerShadow <= body * 0.5) {
      return {
        pattern: 'Shooting Star',
        signal: 'sell',
        strength: 60 + (upperShadow / body) * 5,
        description: 'نمط النجمة الساقطة - إشارة انعكاس هبوطي'
      };
    }

    return null;
  }

  detectDoji(candles: CandleData[]): PatternResult | null {
    if (candles.length < 3) return null;

    const curr = candles[candles.length - 1];
    const body = Math.abs(curr.close - curr.open);
    const totalRange = curr.high - curr.low;

    if (totalRange === 0) return null;

    if (body / totalRange < 0.1) {
      const prevCandles = candles.slice(-5, -1);
      const trend = prevCandles[prevCandles.length - 1].close - prevCandles[0].close;

      if (Math.abs(trend) > totalRange * 2) {
        return {
          pattern: 'Doji',
          signal: 'hold',
          strength: 50,
          description: 'نمط الدوجي - تردد في السوق وإمكانية انعكاس'
        };
      }
    }

    return null;
  }

  analyzePatterns(candles: CandleData[]): AISignal {
    const patterns: PatternResult[] = [];

    const doubleTop = this.detectDoubleTop(candles);
    if (doubleTop) patterns.push(doubleTop);

    const doubleBottom = this.detectDoubleBottom(candles);
    if (doubleBottom) patterns.push(doubleBottom);

    const engulfing = this.detectEngulfingPattern(candles);
    if (engulfing) patterns.push(engulfing);

    const hammer = this.detectHammer(candles);
    if (hammer) patterns.push(hammer);

    const doji = this.detectDoji(candles);
    if (doji) patterns.push(doji);

    if (patterns.length === 0) {
      return {
        signal: 'hold',
        strength: 0,
        confidence: 0,
        description: 'لا توجد أنماط سعرية مكتشفة'
      };
    }

    const buyPatterns = patterns.filter(p => p.signal === 'buy');
    const sellPatterns = patterns.filter(p => p.signal === 'sell');

    if (buyPatterns.length > sellPatterns.length) {
      const avgStrength = buyPatterns.reduce((sum, p) => sum + p.strength, 0) / buyPatterns.length;
      return {
        signal: 'buy',
        strength: avgStrength,
        confidence: Math.min(buyPatterns.length * 20 + 40, 90),
        description: `أنماط صعودية: ${buyPatterns.map(p => p.pattern).join(', ')}`
      };
    } else if (sellPatterns.length > buyPatterns.length) {
      const avgStrength = sellPatterns.reduce((sum, p) => sum + p.strength, 0) / sellPatterns.length;
      return {
        signal: 'sell',
        strength: avgStrength,
        confidence: Math.min(sellPatterns.length * 20 + 40, 90),
        description: `أنماط هبوطية: ${sellPatterns.map(p => p.pattern).join(', ')}`
      };
    }

    return {
      signal: 'hold',
      strength: 30,
      confidence: 40,
      description: 'إشارات متضاربة من الأنماط السعرية'
    };
  }

  analyzeMomentum(candles: CandleData[]): AISignal {
    const prices = candles.map(c => c.close);
    
    if (prices.length < 15) {
      return { signal: 'hold', strength: 0, confidence: 0, description: 'بيانات غير كافية' };
    }

    const shortMom = this.calculateMomentum(prices, 5);
    const medMom = this.calculateMomentum(prices, 10);
    const roc = this.calculateROC(prices, 12);

    const currentShortMom = shortMom[shortMom.length - 1] || 0;
    const currentMedMom = medMom[medMom.length - 1] || 0;
    const currentROC = roc[roc.length - 1] || 0;

    const prevShortMom = shortMom[shortMom.length - 2] || 0;
    
    const momAccelerating = currentShortMom > prevShortMom;
    const momPositive = currentShortMom > 0 && currentMedMom > 0;
    const momNegative = currentShortMom < 0 && currentMedMom < 0;

    let signal: 'buy' | 'sell' | 'hold' = 'hold';
    let strength = 0;
    let confidence = 50;
    let description = '';

    if (momPositive && momAccelerating && currentROC > 0) {
      signal = 'buy';
      strength = Math.min(50 + Math.abs(currentShortMom) * 5, 90);
      confidence = 60 + Math.min(Math.abs(currentMedMom) * 3, 30);
      description = `زخم صعودي متسارع (قصير: ${currentShortMom.toFixed(2)}%, متوسط: ${currentMedMom.toFixed(2)}%)`;
    } else if (momNegative && !momAccelerating && currentROC < 0) {
      signal = 'sell';
      strength = Math.min(50 + Math.abs(currentShortMom) * 5, 90);
      confidence = 60 + Math.min(Math.abs(currentMedMom) * 3, 30);
      description = `زخم هبوطي متسارع (قصير: ${currentShortMom.toFixed(2)}%, متوسط: ${currentMedMom.toFixed(2)}%)`;
    } else if (momPositive) {
      signal = 'buy';
      strength = 40 + Math.abs(currentShortMom) * 3;
      confidence = 50;
      description = 'زخم صعودي معتدل';
    } else if (momNegative) {
      signal = 'sell';
      strength = 40 + Math.abs(currentShortMom) * 3;
      confidence = 50;
      description = 'زخم هبوطي معتدل';
    } else {
      description = 'زخم محايد';
    }

    return { signal, strength: Math.min(strength, 100), confidence: Math.min(confidence, 95), description };
  }

  analyzeVolatility(candles: CandleData[]): AISignal {
    if (candles.length < 25) {
      return { signal: 'hold', strength: 0, confidence: 0, description: 'بيانات غير كافية' };
    }

    const prices = candles.map(c => c.close);
    const atr = this.calculateATR(candles, 14);
    const bb = this.calculateBollingerBands(prices, 20, 2);

    const currentATR = atr[atr.length - 1] || 0;
    const avgATR = atr.slice(-10).reduce((a, b) => a + b, 0) / 10;
    const currentPrice = prices[prices.length - 1];
    
    const currentPercentB = bb.percentB[bb.percentB.length - 1] || 0.5;
    const currentBandwidth = bb.bandwidth[bb.bandwidth.length - 1] || 0;
    const avgBandwidth = bb.bandwidth.slice(-10).reduce((a, b) => a + b, 0) / 10;

    const volatilityIncreasing = currentATR > avgATR * 1.2;
    const volatilityDecreasing = currentATR < avgATR * 0.8;
    const bandwidthSqueezing = currentBandwidth < avgBandwidth * 0.7;

    let signal: 'buy' | 'sell' | 'hold' = 'hold';
    let strength = 0;
    let confidence = 50;
    let description = '';

    if (currentPercentB < 0.05 && volatilityIncreasing) {
      signal = 'buy';
      strength = 70 + (0.1 - currentPercentB) * 200;
      confidence = 70;
      description = 'السعر عند الحد السفلي للبولينجر مع ارتفاع التقلب - إمكانية ارتداد';
    } else if (currentPercentB > 0.95 && volatilityIncreasing) {
      signal = 'sell';
      strength = 70 + (currentPercentB - 0.9) * 200;
      confidence = 70;
      description = 'السعر عند الحد العلوي للبولينجر مع ارتفاع التقلب - إمكانية تصحيح';
    } else if (bandwidthSqueezing) {
      signal = 'hold';
      strength = 60;
      confidence = 65;
      description = 'ضغط البولينجر - توقع حركة قوية قادمة';
    } else if (currentPercentB < 0.2) {
      signal = 'buy';
      strength = 50;
      confidence = 55;
      description = 'السعر قرب الحد السفلي للبولينجر';
    } else if (currentPercentB > 0.8) {
      signal = 'sell';
      strength = 50;
      confidence = 55;
      description = 'السعر قرب الحد العلوي للبولينجر';
    } else {
      description = `تقلب ${volatilityIncreasing ? 'مرتفع' : volatilityDecreasing ? 'منخفض' : 'طبيعي'}`;
    }

    return { signal, strength: Math.min(strength, 100), confidence: Math.min(confidence, 95), description };
  }

  analyzeTrendStrength(candles: CandleData[]): AISignal {
    if (candles.length < 30) {
      return { signal: 'hold', strength: 0, confidence: 0, description: 'بيانات غير كافية' };
    }

    const prices = candles.map(c => c.close);
    
    const sma10 = prices.slice(-10).reduce((a, b) => a + b, 0) / 10;
    const sma20 = prices.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const sma50 = prices.slice(-Math.min(50, prices.length)).reduce((a, b) => a + b, 0) / Math.min(50, prices.length);

    const currentPrice = prices[prices.length - 1];
    
    const priceAboveSMA10 = currentPrice > sma10;
    const priceAboveSMA20 = currentPrice > sma20;
    const sma10AboveSMA20 = sma10 > sma20;
    const sma20AboveSMA50 = sma20 > sma50;

    let trendScore = 0;
    if (priceAboveSMA10) trendScore += 1;
    if (priceAboveSMA20) trendScore += 1;
    if (sma10AboveSMA20) trendScore += 1;
    if (sma20AboveSMA50) trendScore += 1;

    let signal: 'buy' | 'sell' | 'hold' = 'hold';
    let strength = 0;
    let confidence = 50;
    let description = '';

    if (trendScore >= 3) {
      signal = 'buy';
      strength = 50 + trendScore * 10;
      confidence = 55 + trendScore * 8;
      description = `اتجاه صعودي قوي (${trendScore}/4 مؤشرات)`;
    } else if (trendScore <= 1) {
      signal = 'sell';
      strength = 50 + (4 - trendScore) * 10;
      confidence = 55 + (4 - trendScore) * 8;
      description = `اتجاه هبوطي قوي (${4 - trendScore}/4 مؤشرات)`;
    } else {
      description = 'اتجاه غير واضح';
    }

    return { signal, strength: Math.min(strength, 100), confidence: Math.min(confidence, 95), description };
  }

  analyzePriceAction(candles: CandleData[]): AISignal {
    if (candles.length < 10) {
      return { signal: 'hold', strength: 0, confidence: 0, description: 'بيانات غير كافية' };
    }

    const recent = candles.slice(-10);
    const volumes = recent.map(c => c.volume);
    const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
    const currentVolume = volumes[volumes.length - 1];
    
    const currentCandle = recent[recent.length - 1];
    const prevCandle = recent[recent.length - 2];
    
    const currentBody = currentCandle.close - currentCandle.open;
    const prevBody = prevCandle.close - prevCandle.open;
    
    const bullishCandle = currentBody > 0;
    const bearishCandle = currentBody < 0;
    const volumeSpike = currentVolume > avgVolume * 1.5;

    let signal: 'buy' | 'sell' | 'hold' = 'hold';
    let strength = 0;
    let confidence = 50;
    let description = '';

    if (bullishCandle && volumeSpike && currentBody > Math.abs(prevBody)) {
      signal = 'buy';
      strength = 65 + (currentVolume / avgVolume - 1) * 20;
      confidence = 65;
      description = 'شمعة صعودية قوية مع حجم تداول مرتفع';
    } else if (bearishCandle && volumeSpike && Math.abs(currentBody) > Math.abs(prevBody)) {
      signal = 'sell';
      strength = 65 + (currentVolume / avgVolume - 1) * 20;
      confidence = 65;
      description = 'شمعة هبوطية قوية مع حجم تداول مرتفع';
    } else if (bullishCandle) {
      signal = 'buy';
      strength = 40;
      confidence = 45;
      description = 'شمعة صعودية';
    } else if (bearishCandle) {
      signal = 'sell';
      strength = 40;
      confidence = 45;
      description = 'شمعة هبوطية';
    } else {
      description = 'حركة سعرية محايدة';
    }

    return { signal, strength: Math.min(strength, 100), confidence: Math.min(confidence, 95), description };
  }

  detectMarketRegime(candles: CandleData[]): 'trending_up' | 'trending_down' | 'ranging' | 'volatile' {
    if (candles.length < 30) return 'ranging';

    const prices = candles.map(c => c.close);
    const atr = this.calculateATR(candles, 14);
    
    const recentPrices = prices.slice(-20);
    const priceChange = (recentPrices[recentPrices.length - 1] - recentPrices[0]) / recentPrices[0] * 100;
    
    const currentATR = atr[atr.length - 1] || 0;
    const avgATR = atr.slice(-20).reduce((a, b) => a + b, 0) / Math.min(20, atr.length);
    const volatilityRatio = currentATR / avgATR;

    if (volatilityRatio > 1.5) return 'volatile';
    if (priceChange > 5) return 'trending_up';
    if (priceChange < -5) return 'trending_down';
    return 'ranging';
  }

  assessRiskLevel(candles: CandleData[]): 'low' | 'medium' | 'high' {
    if (candles.length < 20) return 'medium';

    const atr = this.calculateATR(candles, 14);
    const currentATR = atr[atr.length - 1] || 0;
    const avgATR = atr.slice(-20).reduce((a, b) => a + b, 0) / Math.min(20, atr.length);
    
    const volatilityRatio = currentATR / avgATR;

    if (volatilityRatio > 1.5) return 'high';
    if (volatilityRatio < 0.7) return 'low';
    return 'medium';
  }

  predict(candles: CandleData[]): AIPrediction {
    const patternRecognition = this.analyzePatterns(candles);
    const momentumAnalysis = this.analyzeMomentum(candles);
    const volatilityAnalysis = this.analyzeVolatility(candles);
    const trendStrength = this.analyzeTrendStrength(candles);
    const priceAction = this.analyzePriceAction(candles);

    const weights = {
      patternRecognition: 0.25,
      momentumAnalysis: 0.20,
      volatilityAnalysis: 0.15,
      trendStrength: 0.25,
      priceAction: 0.15
    };

    const signals = [
      { analysis: patternRecognition, weight: weights.patternRecognition },
      { analysis: momentumAnalysis, weight: weights.momentumAnalysis },
      { analysis: volatilityAnalysis, weight: weights.volatilityAnalysis },
      { analysis: trendStrength, weight: weights.trendStrength },
      { analysis: priceAction, weight: weights.priceAction }
    ];

    let buyScore = 0;
    let sellScore = 0;
    let totalWeight = 0;
    let totalConfidence = 0;

    for (const { analysis, weight } of signals) {
      const weightedScore = (analysis.strength / 100) * weight * (analysis.confidence / 100);
      totalConfidence += analysis.confidence * weight;
      totalWeight += weight;

      if (analysis.signal === 'buy') {
        buyScore += weightedScore;
      } else if (analysis.signal === 'sell') {
        sellScore += weightedScore;
      }
    }

    let overallSignal: 'buy' | 'sell' | 'hold' = 'hold';
    let signalStrength = 0;

    const threshold = 0.15;
    if (buyScore - sellScore > threshold) {
      overallSignal = 'buy';
      signalStrength = Math.min(buyScore * 200, 100);
    } else if (sellScore - buyScore > threshold) {
      overallSignal = 'sell';
      signalStrength = Math.min(sellScore * 200, 100);
    } else {
      signalStrength = Math.abs(buyScore - sellScore) * 100;
    }

    const confidence = totalConfidence / totalWeight;

    const detectedPatterns: PatternResult[] = [];
    const doubleTop = this.detectDoubleTop(candles);
    if (doubleTop) detectedPatterns.push(doubleTop);
    const doubleBottom = this.detectDoubleBottom(candles);
    if (doubleBottom) detectedPatterns.push(doubleBottom);
    const engulfing = this.detectEngulfingPattern(candles);
    if (engulfing) detectedPatterns.push(engulfing);
    const hammer = this.detectHammer(candles);
    if (hammer) detectedPatterns.push(hammer);
    const doji = this.detectDoji(candles);
    if (doji) detectedPatterns.push(doji);

    const marketRegime = this.detectMarketRegime(candles);
    const riskLevel = this.assessRiskLevel(candles);

    const shortTermPrediction = overallSignal === 'buy' ? 'bullish' : overallSignal === 'sell' ? 'bearish' : 'neutral';
    const mediumTermPrediction = trendStrength.signal === 'buy' ? 'bullish' : trendStrength.signal === 'sell' ? 'bearish' : 'neutral';

    return {
      overallSignal,
      confidence: Math.round(confidence),
      signalStrength: Math.round(signalStrength),
      predictions: {
        patternRecognition,
        momentumAnalysis,
        volatilityAnalysis,
        trendStrength,
        priceAction
      },
      detectedPatterns,
      marketRegime,
      riskLevel,
      shortTermPrediction,
      mediumTermPrediction
    };
  }
}

export const aiPredictor = new AIPredictor();
