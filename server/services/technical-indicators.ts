export interface CandleData {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
}

export interface IndicatorResult {
  value: number;
  signal: 'buy' | 'sell' | 'hold';
  strength: number;
}

export interface TechnicalAnalysisResult {
  rsi: IndicatorResult;
  macd: IndicatorResult;
  maCross: IndicatorResult;
  overallSignal: 'buy' | 'sell' | 'hold';
  signalStrength: number;
  confirmedSignals: number;
}

export class TechnicalIndicators {
  private rsiPeriod: number;
  private rsiOverbought: number;
  private rsiOversold: number;
  private maShortPeriod: number;
  private maLongPeriod: number;
  private macdFast: number;
  private macdSlow: number;
  private macdSignal: number;

  constructor(settings?: {
    rsiPeriod?: number;
    rsiOverbought?: number;
    rsiOversold?: number;
    maShortPeriod?: number;
    maLongPeriod?: number;
    macdFast?: number;
    macdSlow?: number;
    macdSignal?: number;
  }) {
    this.rsiPeriod = settings?.rsiPeriod || 14;
    this.rsiOverbought = settings?.rsiOverbought || 70;
    this.rsiOversold = settings?.rsiOversold || 30;
    this.maShortPeriod = settings?.maShortPeriod || 50;
    this.maLongPeriod = settings?.maLongPeriod || 200;
    this.macdFast = settings?.macdFast || 12;
    this.macdSlow = settings?.macdSlow || 26;
    this.macdSignal = settings?.macdSignal || 9;
  }

  calculateSMA(prices: number[], period: number): number[] {
    const sma: number[] = [];
    for (let i = period - 1; i < prices.length; i++) {
      const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      sma.push(sum / period);
    }
    return sma;
  }

  calculateEMA(prices: number[], period: number): number[] {
    const ema: number[] = [];
    const multiplier = 2 / (period + 1);
    
    const firstSMA = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
    ema.push(firstSMA);
    
    for (let i = period; i < prices.length; i++) {
      const value = (prices[i] - ema[ema.length - 1]) * multiplier + ema[ema.length - 1];
      ema.push(value);
    }
    
    return ema;
  }

  calculateRSI(prices: number[]): IndicatorResult {
    if (prices.length < this.rsiPeriod + 1) {
      return { value: 50, signal: 'hold', strength: 0 };
    }

    const changes: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      changes.push(prices[i] - prices[i - 1]);
    }

    let avgGain = 0;
    let avgLoss = 0;

    for (let i = 0; i < this.rsiPeriod; i++) {
      if (changes[i] > 0) {
        avgGain += changes[i];
      } else {
        avgLoss += Math.abs(changes[i]);
      }
    }

    avgGain /= this.rsiPeriod;
    avgLoss /= this.rsiPeriod;

    for (let i = this.rsiPeriod; i < changes.length; i++) {
      if (changes[i] > 0) {
        avgGain = (avgGain * (this.rsiPeriod - 1) + changes[i]) / this.rsiPeriod;
        avgLoss = (avgLoss * (this.rsiPeriod - 1)) / this.rsiPeriod;
      } else {
        avgGain = (avgGain * (this.rsiPeriod - 1)) / this.rsiPeriod;
        avgLoss = (avgLoss * (this.rsiPeriod - 1) + Math.abs(changes[i])) / this.rsiPeriod;
      }
    }

    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));

    let signal: 'buy' | 'sell' | 'hold' = 'hold';
    let strength = 0;

    if (rsi <= this.rsiOversold) {
      signal = 'buy';
      strength = ((this.rsiOversold - rsi) / this.rsiOversold) * 100;
    } else if (rsi >= this.rsiOverbought) {
      signal = 'sell';
      strength = ((rsi - this.rsiOverbought) / (100 - this.rsiOverbought)) * 100;
    }

    return { value: rsi, signal, strength };
  }

  calculateMACD(prices: number[]): IndicatorResult {
    if (prices.length < this.macdSlow + this.macdSignal) {
      return { value: 0, signal: 'hold', strength: 0 };
    }

    const fastEMA = this.calculateEMA(prices, this.macdFast);
    const slowEMA = this.calculateEMA(prices, this.macdSlow);
    
    const offset = this.macdSlow - this.macdFast;
    const macdLine: number[] = [];
    
    for (let i = 0; i < slowEMA.length; i++) {
      macdLine.push(fastEMA[i + offset] - slowEMA[i]);
    }
    
    const signalLine = this.calculateEMA(macdLine, this.macdSignal);
    
    const currentMACD = macdLine[macdLine.length - 1];
    const currentSignal = signalLine[signalLine.length - 1];
    const previousMACD = macdLine[macdLine.length - 2];
    const previousSignal = signalLine[signalLine.length - 2];
    
    let signal: 'buy' | 'sell' | 'hold' = 'hold';
    let strength = 0;
    
    if (previousMACD <= previousSignal && currentMACD > currentSignal) {
      signal = 'buy';
      strength = Math.min(Math.abs(currentMACD - currentSignal) * 100, 100);
    } else if (previousMACD >= previousSignal && currentMACD < currentSignal) {
      signal = 'sell';
      strength = Math.min(Math.abs(currentMACD - currentSignal) * 100, 100);
    }
    
    return { value: currentMACD, signal, strength };
  }

  calculateMACross(prices: number[]): IndicatorResult {
    if (prices.length < this.maLongPeriod) {
      return { value: 0, signal: 'hold', strength: 0 };
    }

    const shortMA = this.calculateSMA(prices, this.maShortPeriod);
    const longMA = this.calculateSMA(prices, this.maLongPeriod);
    
    const offset = this.maLongPeriod - this.maShortPeriod;
    
    const currentShortMA = shortMA[shortMA.length - 1];
    const currentLongMA = longMA[longMA.length - 1];
    const previousShortMA = shortMA[shortMA.length - 2];
    const previousLongMA = longMA[longMA.length - 2];
    
    let signal: 'buy' | 'sell' | 'hold' = 'hold';
    let strength = 0;
    
    if (previousShortMA <= previousLongMA && currentShortMA > currentLongMA) {
      signal = 'buy';
      strength = ((currentShortMA - currentLongMA) / currentLongMA) * 1000;
    } else if (previousShortMA >= previousLongMA && currentShortMA < currentLongMA) {
      signal = 'sell';
      strength = ((currentLongMA - currentShortMA) / currentLongMA) * 1000;
    } else if (currentShortMA > currentLongMA) {
      signal = 'buy';
      strength = ((currentShortMA - currentLongMA) / currentLongMA) * 500;
    } else if (currentShortMA < currentLongMA) {
      signal = 'sell';
      strength = ((currentLongMA - currentShortMA) / currentLongMA) * 500;
    }
    
    strength = Math.min(strength, 100);
    
    return { value: currentShortMA - currentLongMA, signal, strength };
  }

  analyze(prices: number[]): TechnicalAnalysisResult {
    const rsi = this.calculateRSI(prices);
    const macd = this.calculateMACD(prices);
    const maCross = this.calculateMACross(prices);
    
    const signals = [rsi.signal, macd.signal, maCross.signal];
    const buySignals = signals.filter(s => s === 'buy').length;
    const sellSignals = signals.filter(s => s === 'sell').length;
    
    let overallSignal: 'buy' | 'sell' | 'hold' = 'hold';
    let confirmedSignals = 0;
    
    // تم تخفيف الشرط: مؤشر واحد كافي للإشارة بدلاً من 2
    if (buySignals >= 1) {
      overallSignal = 'buy';
      confirmedSignals = buySignals;
    } else if (sellSignals >= 1) {
      overallSignal = 'sell';
      confirmedSignals = sellSignals;
    }
    
    const avgStrength = (rsi.strength + macd.strength + maCross.strength) / 3;
    const signalStrength = confirmedSignals >= 1 
      ? (confirmedSignals / 3) * 100 + avgStrength * 0.5
      : avgStrength * 0.3;
    
    return {
      rsi,
      macd,
      maCross,
      overallSignal,
      signalStrength: Math.round(signalStrength),
      confirmedSignals,
    };
  }
}

export const technicalIndicators = new TechnicalIndicators();
