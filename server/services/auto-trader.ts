import type { BotSettings, Trade } from "@shared/schema";
import { binanceService } from "./binance";
import { TechnicalIndicators, TechnicalAnalysisResult } from "./technical-indicators";
import { telegramService } from "./telegram";
import { storage } from "../storage";
import { aiPredictor, AIPrediction } from "./ai-predictor";
import { AdvancedStrategies, StrategyType, StrategySignal } from "./advanced-strategies";
import { smartPositionSizing } from "./smart-position-sizing";
import { marketFilter } from "./market-filter";

interface AutoTradeConfig {
  minSignalStrength: number;
  maxDailyTrades: number;
  tradeCooldownMinutes: number;
  tradingPairs: string[];
  maxRiskPerTrade: number;
  riskRewardRatio: number;
  multiTimeframeEnabled: boolean;
  timeframes: string[];
  trailingStopEnabled: boolean;
  trailingStopPercent: number;
  trailingStopActivationPercent: number;
  // AI Trading Settings
  aiTradingEnabled: boolean;
  aiMinConfidence: number;
  aiMinSignalStrength: number;
  aiRequiredSignals: number;
  // Advanced Strategies Settings
  advancedStrategiesEnabled: boolean;
  enabledStrategies: StrategyType[];
  strategyMinConfidence: number;
  strategyMinStrength: number;
  requireStrategyConsensus: boolean;
  // Smart Position Sizing
  smartPositionSizingEnabled: boolean;
  // Market Filter
  marketFilterEnabled: boolean;
  // Account Protection
  accountProtectionEnabled: boolean;
}

interface AITradeSignal {
  symbol: string;
  signal: 'buy' | 'sell';
  confidence: number;
  signalStrength: number;
  prediction: AIPrediction;
  indicators: string[];
}

interface SignalAnalysis {
  symbol: string;
  timeframe: string;
  signal: 'buy' | 'sell' | 'hold';
  strength: number;
  indicators: string[];
  analysis: TechnicalAnalysisResult;
}

interface MultiTimeframeResult {
  symbol: string;
  overallSignal: 'buy' | 'sell' | 'hold';
  overallStrength: number;
  timeframeResults: SignalAnalysis[];
  confirmedTimeframes: number;
}

export class AutoTrader {
  private isRunning: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;
  private lastTradeTime: Record<string, number> = {};
  private dailyTradeCount: number = 0;
  private lastDayReset: string = '';
  private settings: BotSettings | null = null;

  constructor() {
    this.resetDailyCounterIfNeeded();
  }

  private resetDailyCounterIfNeeded() {
    const today = new Date().toDateString();
    if (this.lastDayReset !== today) {
      this.dailyTradeCount = 0;
      this.lastDayReset = today;
    }
  }

  async start(settings: BotSettings) {
    if (this.isRunning) {
      console.log('Auto trader already running');
      return;
    }

    this.settings = settings;
    this.isRunning = true;

    binanceService.updateSettings(settings);
    telegramService.updateSettings(settings);

    console.log('Auto trader started');
    
    // Log asynchronously to not block startup
    storage.createLog({
      level: 'success',
      message: 'تم تشغيل التداول التلقائي',
      details: `أزواج العملات: ${settings.tradingPairs?.join(', ')}`,
    }).catch(err => console.error('Failed to log auto trader start:', err));

    // Set up the recurring trading cycle
    this.intervalId = setInterval(() => this.runTradingCycle(), 60000);
    
    // Defer first trading cycle to not block server initialization
    setTimeout(() => this.runTradingCycle(), 3000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('Auto trader stopped');
  }

  isActive(): boolean {
    return this.isRunning;
  }

  updateSettings(settings: BotSettings) {
    this.settings = settings;
    binanceService.updateSettings(settings);
    telegramService.updateSettings(settings);
    smartPositionSizing.updateSettings(settings);
    marketFilter.updateSettings(settings);
    console.log('Auto trader settings updated:', settings.tradingPairs?.join(', '));
  }

  private async runTradingCycle() {
    // جلب أحدث الإعدادات من قاعدة البيانات في كل دورة
    const latestSettings = await storage.getSettings();
    if (latestSettings) {
      this.settings = latestSettings;
      binanceService.updateSettings(latestSettings);
    }

    if (!this.settings || !this.settings.autoTradingEnabled) {
      return;
    }

    this.resetDailyCounterIfNeeded();

    const config: AutoTradeConfig = {
      minSignalStrength: this.settings.minSignalStrength || 70,
      maxDailyTrades: this.settings.maxDailyTrades || 10,
      tradeCooldownMinutes: this.settings.tradeCooldownMinutes || 30,
      tradingPairs: this.settings.tradingPairs || ['BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT', 'XRP/USDT', 'ADA/USDT', 'DOGE/USDT', 'LINK/USDT', 'AVAX/USDT', 'LTC/USDT', 'DOT/USDT'],
      maxRiskPerTrade: this.settings.maxRiskPerTrade || 2,
      riskRewardRatio: this.settings.riskRewardRatio || 1.5,
      multiTimeframeEnabled: this.settings.multiTimeframeEnabled || false,
      timeframes: this.settings.timeframes || ['15m', '1h', '4h'],
      trailingStopEnabled: this.settings.trailingStopEnabled || false,
      trailingStopPercent: this.settings.trailingStopPercent || 1,
      trailingStopActivationPercent: this.settings.trailingStopActivationPercent || 1,
      // AI Trading Settings
      aiTradingEnabled: this.settings.aiTradingEnabled || false,
      aiMinConfidence: this.settings.aiMinConfidence || 70,
      aiMinSignalStrength: this.settings.aiMinSignalStrength || 60,
      aiRequiredSignals: this.settings.aiRequiredSignals || 3,
      // Advanced Strategies Settings
      advancedStrategiesEnabled: this.settings.advancedStrategiesEnabled || false,
      enabledStrategies: (this.settings.enabledStrategies as StrategyType[]) || ['breakout', 'momentum', 'meanReversion', 'swing'],
      strategyMinConfidence: this.settings.strategyMinConfidence || 60,
      strategyMinStrength: this.settings.strategyMinStrength || 50,
      requireStrategyConsensus: this.settings.requireStrategyConsensus || false,
      // Smart Position Sizing
      smartPositionSizingEnabled: this.settings.smartPositionSizingEnabled || false,
      // Market Filter
      marketFilterEnabled: this.settings.marketFilterEnabled || false,
      // Account Protection
      accountProtectionEnabled: this.settings.accountProtectionEnabled || false,
    };

    // Update services with latest settings
    smartPositionSizing.updateSettings(this.settings);
    marketFilter.updateSettings(this.settings);

    if (this.dailyTradeCount >= config.maxDailyTrades) {
      console.log(`Daily trade limit reached: ${this.dailyTradeCount}/${config.maxDailyTrades}`);
      return;
    }

    // Sync trades with Binance to detect closed positions
    await this.syncTradesWithBinance();

    for (const pair of config.tradingPairs) {
      try {
        await this.analyzePair(pair, config);
      } catch (error) {
        console.error(`Error analyzing ${pair}:`, error);
      }
    }

    await this.updateTrailingStops(config);
  }

  private async analyzeWithAI(symbol: string, config: AutoTradeConfig): Promise<AITradeSignal | null> {
    const formattedSymbol = symbol.replace('/', '');
    
    try {
      const candles = await binanceService.getKlinesOHLCV(formattedSymbol, '1h', 100);
      
      if (candles.length < 30) {
        console.log(`${symbol}: Not enough candle data for AI analysis`);
        return null;
      }
      
      const prediction = aiPredictor.predict(candles);
      
      // Count confirming signals (buy/sell signals from different modules)
      const signals = [
        prediction.predictions.patternRecognition,
        prediction.predictions.momentumAnalysis,
        prediction.predictions.volatilityAnalysis,
        prediction.predictions.trendStrength,
        prediction.predictions.priceAction
      ];
      
      const buySignals = signals.filter(s => s.signal === 'buy').length;
      const sellSignals = signals.filter(s => s.signal === 'sell').length;
      
      // Build indicators list for logging
      const indicators: string[] = [];
      if (prediction.predictions.patternRecognition.signal !== 'hold') {
        indicators.push(`الأنماط (${prediction.predictions.patternRecognition.signal})`);
      }
      if (prediction.predictions.momentumAnalysis.signal !== 'hold') {
        indicators.push(`الزخم (${prediction.predictions.momentumAnalysis.signal})`);
      }
      if (prediction.predictions.trendStrength.signal !== 'hold') {
        indicators.push(`الاتجاه (${prediction.predictions.trendStrength.signal})`);
      }
      if (prediction.predictions.priceAction.signal !== 'hold') {
        indicators.push(`حركة السعر (${prediction.predictions.priceAction.signal})`);
      }
      
      // Add detected patterns
      prediction.detectedPatterns.forEach(p => {
        indicators.push(p.pattern);
      });
      
      console.log(`[AI] ${symbol}: Signal=${prediction.overallSignal}, Confidence=${prediction.confidence}%, Strength=${prediction.signalStrength}%, Buy=${buySignals}, Sell=${sellSignals}`);
      
      // Check if meets threshold requirements
      if (prediction.confidence < config.aiMinConfidence) {
        console.log(`[AI] ${symbol}: Confidence too low (${prediction.confidence}% < ${config.aiMinConfidence}%)`);
        return null;
      }
      
      if (prediction.signalStrength < config.aiMinSignalStrength) {
        console.log(`[AI] ${symbol}: Signal strength too low (${prediction.signalStrength}% < ${config.aiMinSignalStrength}%)`);
        return null;
      }
      
      const requiredSignals = config.aiRequiredSignals;
      if (prediction.overallSignal === 'buy' && buySignals < requiredSignals) {
        console.log(`[AI] ${symbol}: Not enough buy confirmations (${buySignals}/${requiredSignals})`);
        return null;
      }
      if (prediction.overallSignal === 'sell' && sellSignals < requiredSignals) {
        console.log(`[AI] ${symbol}: Not enough sell confirmations (${sellSignals}/${requiredSignals})`);
        return null;
      }
      
      // Only proceed with buy or sell signals
      if (prediction.overallSignal === 'hold') {
        console.log(`[AI] ${symbol}: Hold signal - no trade`);
        return null;
      }
      
      // Check risk level - skip high risk trades
      if (prediction.riskLevel === 'high') {
        console.log(`[AI] ${symbol}: Skipping due to high risk level`);
        return null;
      }
      
      // At this point we know signal is either 'buy' or 'sell'
      const validSignal: 'buy' | 'sell' = prediction.overallSignal;
      
      return {
        symbol,
        signal: validSignal,
        confidence: prediction.confidence,
        signalStrength: prediction.signalStrength,
        prediction,
        indicators
      };
    } catch (error) {
      console.error(`[AI] Error analyzing ${symbol}:`, error);
      return null;
    }
  }

  private async analyzeWithAdvancedStrategies(symbol: string, config: AutoTradeConfig): Promise<{
    signal: 'buy' | 'sell' | null;
    strength: number;
    confidence: number;
    strategyName: string;
    reason: string;
    levels?: { entry: number; stopLoss: number; takeProfit: number };
  } | null> {
    const formattedSymbol = symbol.replace('/', '');
    
    try {
      const candles = await binanceService.getKlinesOHLCV(formattedSymbol, '1h', 100);
      
      if (candles.length < 50) {
        console.log(`[STRATEGY] ${symbol}: Not enough candle data for advanced strategies`);
        return null;
      }
      
      const strategiesAnalyzer = new AdvancedStrategies({
        breakout: {
          lookbackPeriod: this.settings?.breakoutLookbackPeriod || 20,
          breakoutThreshold: this.settings?.breakoutThreshold || 1.5,
          volumeMultiplier: this.settings?.breakoutVolumeMultiplier || 1.5,
        },
        scalping: {
          profitTarget: this.settings?.scalpingProfitTarget || 0.5,
          stopLoss: this.settings?.scalpingStopLoss || 0.3,
          maxHoldingPeriod: this.settings?.scalpingMaxHoldingPeriod || 15,
        },
        momentum: {
          lookbackPeriod: this.settings?.momentumLookbackPeriod || 14,
          momentumThreshold: this.settings?.momentumThreshold || 2,
          trendStrength: 60,
        },
        meanReversion: {
          bollingerPeriod: this.settings?.meanReversionBollingerPeriod || 20,
          bollingerStdDev: this.settings?.meanReversionBollingerStdDev || 2,
          oversoldLevel: this.settings?.meanReversionOversoldLevel || 20,
          overboughtLevel: this.settings?.meanReversionOverboughtLevel || 80,
        },
        swing: {
          swingPeriod: this.settings?.swingPeriod || 10,
          minSwingSize: this.settings?.swingMinSize || 2,
          confirmationCandles: this.settings?.swingConfirmationCandles || 3,
        },
        gridTrading: {
          gridLevels: this.settings?.gridLevels || 5,
          gridSpacing: this.settings?.gridSpacing || 1,
          orderSize: this.settings?.gridOrderSize || 10,
        },
      });
      
      const result = strategiesAnalyzer.analyze(candles, config.enabledStrategies);
      
      console.log(`[STRATEGY] ${symbol}: Analyzed ${result.signals.length} strategies, consensus: ${result.consensus} (${result.consensusStrength.toFixed(0)}%)`);
      
      // Log individual strategy signals
      result.signals.forEach(sig => {
        if (sig.signal !== 'hold') {
          console.log(`  - ${sig.strategy}: ${sig.signal} (strength: ${sig.strength.toFixed(0)}%, confidence: ${sig.confidence.toFixed(0)}%) - ${sig.reason}`);
        }
      });
      
      // Check if we require consensus
      if (config.requireStrategyConsensus) {
        if (result.consensus === 'hold' || result.consensusStrength < config.strategyMinStrength) {
          console.log(`[STRATEGY] ${symbol}: No consensus signal or strength too low`);
          return null;
        }
        
        return {
          signal: result.consensus,
          strength: result.consensusStrength,
          confidence: result.consensusStrength,
          strategyName: 'Consensus',
          reason: `إجماع ${result.signals.filter(s => s.signal === result.consensus).length} استراتيجيات`,
          levels: result.bestSignal?.levels,
        };
      }
      
      // Use best signal if no consensus required
      if (!result.bestSignal || result.bestSignal.signal === 'hold') {
        console.log(`[STRATEGY] ${symbol}: No actionable signal from strategies`);
        return null;
      }
      
      if (result.bestSignal.confidence < config.strategyMinConfidence) {
        console.log(`[STRATEGY] ${symbol}: Best signal confidence too low (${result.bestSignal.confidence.toFixed(0)}% < ${config.strategyMinConfidence}%)`);
        return null;
      }
      
      if (result.bestSignal.strength < config.strategyMinStrength) {
        console.log(`[STRATEGY] ${symbol}: Best signal strength too low (${result.bestSignal.strength.toFixed(0)}% < ${config.strategyMinStrength}%)`);
        return null;
      }
      
      const strategyNameArabic: Record<string, string> = {
        breakout: 'اختراق',
        scalping: 'سكالبينج',
        momentum: 'زخم',
        meanReversion: 'عودة للمتوسط',
        swing: 'سوينغ',
        gridTrading: 'شبكة',
      };
      
      return {
        signal: result.bestSignal.signal,
        strength: result.bestSignal.strength,
        confidence: result.bestSignal.confidence,
        strategyName: strategyNameArabic[result.bestSignal.strategy] || result.bestSignal.strategy,
        reason: result.bestSignal.reason,
        levels: result.bestSignal.levels,
      };
    } catch (error) {
      console.error(`[STRATEGY] Error analyzing ${symbol}:`, error);
      return null;
    }
  }

  private async analyzePair(symbol: string, config: AutoTradeConfig) {
    const formattedSymbol = symbol.replace('/', '');

    if (this.isInCooldown(formattedSymbol, config.tradeCooldownMinutes)) {
      console.log(`${symbol} in cooldown period`);
      return;
    }

    // Check Market Filter and Account Protection
    if (config.marketFilterEnabled || config.accountProtectionEnabled) {
      const { allowed, marketAnalysis, accountStatus } = await marketFilter.shouldTrade(symbol);
      
      if (!allowed) {
        const reasons = [...marketAnalysis.reasons, ...accountStatus.reasons];
        console.log(`[FILTER] ${symbol}: Trading blocked - ${reasons.join(', ')}`);
        
        if (accountStatus.reasons.length > 0) {
          await storage.createLog({
            level: 'warning',
            message: `تم منع التداول على ${symbol}`,
            details: `الأسباب: ${reasons.join('، ')}`
          });
        }
        return;
      }
      
      if (marketAnalysis.recommendation === 'caution') {
        console.log(`[FILTER] ${symbol}: Trading with caution - score ${marketAnalysis.score}/100`);
      }
    }

    // Diversification check
    if (this.settings?.diversificationEnabled) {
      const activeTrades = await storage.getTrades('active');
      const activePairs = activeTrades.map(t => t.symbol.replace('/', ''));
      const diversificationCheck = await marketFilter.getDiversificationCheck(formattedSymbol, activePairs);
      
      if (!diversificationCheck.allowed) {
        console.log(`[FILTER] ${symbol}: ${diversificationCheck.reason}`);
        return;
      }
    }

    // Check if AI Trading is enabled
    if (config.aiTradingEnabled) {
      const aiSignal = await this.analyzeWithAI(symbol, config);
      
      if (aiSignal) {
        console.log(`[AI] Strong AI signal for ${symbol}: ${aiSignal.signal} (confidence: ${aiSignal.confidence}%, strength: ${aiSignal.signalStrength}%)`);
        
        // Check for active trades
        const tradeType = aiSignal.signal === 'buy' ? 'long' : 'short';
        const activeTrades = await storage.getTrades('active');
        const hedgingEnabled = this.settings?.hedgingMode || false;
        
        const hasActiveTrade = activeTrades.some(t => {
          const symbolMatch = t.symbol.replace('/', '') === formattedSymbol;
          if (!symbolMatch) return false;
          if (hedgingEnabled) return t.type === tradeType;
          return true;
        });

        if (hasActiveTrade) {
          console.log(`[AI] Already have active ${hedgingEnabled ? tradeType + ' ' : ''}trade for ${symbol}`);
          return;
        }

        // Notify via Telegram
        if (telegramService.isConfigured()) {
          await telegramService.notifySignal(
            symbol,
            aiSignal.signal,
            aiSignal.signalStrength,
            ['AI: ' + aiSignal.indicators.join(', ')]
          );
        }

        // Execute trade
        await this.executeTrade(symbol, aiSignal.signal, aiSignal.signalStrength, 
          ['AI Trading', ...aiSignal.indicators], config);
        
        // Log AI trade
        await storage.createLog({
          level: 'success',
          message: `تنفيذ صفقة AI: ${aiSignal.signal === 'buy' ? 'شراء' : 'بيع'} ${symbol}`,
          details: `ثقة: ${aiSignal.confidence}%, قوة: ${aiSignal.signalStrength}%, الأنماط: ${aiSignal.prediction.detectedPatterns.map(p => p.pattern).join(', ') || 'لا يوجد'}`
        });
        
        return;
      }
    }

    // Check Advanced Strategies if enabled
    if (config.advancedStrategiesEnabled) {
      const strategySignal = await this.analyzeWithAdvancedStrategies(symbol, config);
      
      if (strategySignal && strategySignal.signal) {
        console.log(`[STRATEGY] Strong strategy signal for ${symbol}: ${strategySignal.signal} (${strategySignal.strategyName}) - ${strategySignal.reason}`);
        
        // Check for active trades
        const tradeType = strategySignal.signal === 'buy' ? 'long' : 'short';
        const activeTrades = await storage.getTrades('active');
        const hedgingEnabled = this.settings?.hedgingMode || false;
        
        const hasActiveTrade = activeTrades.some(t => {
          const symbolMatch = t.symbol.replace('/', '') === formattedSymbol;
          if (!symbolMatch) return false;
          if (hedgingEnabled) return t.type === tradeType;
          return true;
        });

        if (hasActiveTrade) {
          console.log(`[STRATEGY] Already have active ${hedgingEnabled ? tradeType + ' ' : ''}trade for ${symbol}`);
          return;
        }

        // Notify via Telegram
        if (telegramService.isConfigured()) {
          await telegramService.notifySignal(
            symbol,
            strategySignal.signal,
            strategySignal.strength,
            [`استراتيجية: ${strategySignal.strategyName}`, strategySignal.reason]
          );
        }

        // Execute trade with strategy-provided levels if available
        if (strategySignal.levels) {
          await this.executeTradeWithLevels(
            symbol, 
            strategySignal.signal, 
            strategySignal.strength, 
            [`استراتيجية ${strategySignal.strategyName}`, strategySignal.reason], 
            config,
            strategySignal.levels
          );
        } else {
          await this.executeTrade(
            symbol, 
            strategySignal.signal, 
            strategySignal.strength, 
            [`استراتيجية ${strategySignal.strategyName}`, strategySignal.reason], 
            config
          );
        }
        
        // Log strategy trade
        await storage.createLog({
          level: 'success',
          message: `تنفيذ صفقة استراتيجية: ${strategySignal.signal === 'buy' ? 'شراء' : 'بيع'} ${symbol}`,
          details: `استراتيجية: ${strategySignal.strategyName}, قوة: ${strategySignal.strength.toFixed(0)}%, السبب: ${strategySignal.reason}`
        });
        
        return;
      }
    }

    // Fallback to traditional technical analysis if AI trading and advanced strategies disabled or no signal
    let signalResult: MultiTimeframeResult | SignalAnalysis;

    if (config.multiTimeframeEnabled) {
      signalResult = await this.analyzeMultiTimeframe(symbol, config);
      
      if (signalResult.confirmedTimeframes < 2) {
        console.log(`${symbol}: Not enough timeframe confirmation (${signalResult.confirmedTimeframes}/3)`);
        return;
      }
    } else {
      signalResult = await this.analyzeSingleTimeframe(symbol, '1h');
    }

    const overallSignal = 'overallSignal' in signalResult 
      ? signalResult.overallSignal 
      : signalResult.signal;
    const overallStrength = 'overallStrength' in signalResult 
      ? signalResult.overallStrength 
      : signalResult.strength;

    // تخفيف شرط قوة الإشارة - الحد الأدنى 30% بدلاً من 70%
    const effectiveMinStrength = Math.min(config.minSignalStrength, 30);
    if (overallSignal === 'hold' || overallStrength < effectiveMinStrength) {
      console.log(`${symbol}: Signal too weak (${overallSignal}, ${overallStrength}% < ${effectiveMinStrength}%)`);
      return;
    }

    console.log(`Strong signal detected for ${symbol}: ${overallSignal} (${overallStrength}%)`);

    // Check if we already have an active trade for this symbol
    const tradeType = overallSignal === 'buy' ? 'long' : 'short';
    const activeTrades = await storage.getTrades('active');
    
    // If hedging mode is enabled, only check for same-direction trades
    // If hedging mode is disabled, check for any trade on the same symbol
    const hedgingEnabled = this.settings?.hedgingMode || false;
    
    const hasActiveTrade = activeTrades.some(t => {
      const symbolMatch = t.symbol.replace('/', '') === formattedSymbol;
      if (!symbolMatch) return false;
      
      // In hedging mode, allow opposite direction trades
      if (hedgingEnabled) {
        return t.type === tradeType; // Only block same direction
      }
      
      // Without hedging, block any trade on same symbol
      return true;
    });

    if (hasActiveTrade) {
      console.log(`Already have active ${hedgingEnabled ? tradeType + ' ' : ''}trade for ${symbol}`);
      return;
    }

    const confirmedIndicators = this.getConfirmedIndicators(
      'timeframeResults' in signalResult 
        ? signalResult.timeframeResults 
        : [signalResult]
    );

    if (telegramService.isConfigured()) {
      await telegramService.notifySignal(
        symbol,
        overallSignal,
        overallStrength,
        confirmedIndicators
      );
    }

    await this.executeTrade(symbol, overallSignal, overallStrength, confirmedIndicators, config);
  }

  private async analyzeSingleTimeframe(symbol: string, timeframe: string): Promise<SignalAnalysis> {
    const formattedSymbol = symbol.replace('/', '');
    const prices = await binanceService.getKlines(formattedSymbol, timeframe, 200);

    if (prices.length < 50) {
      return {
        symbol,
        timeframe,
        signal: 'hold',
        strength: 0,
        indicators: [],
        analysis: {
          rsi: { value: 50, signal: 'hold', strength: 0 },
          macd: { value: 0, signal: 'hold', strength: 0 },
          maCross: { value: 0, signal: 'hold', strength: 0 },
          overallSignal: 'hold',
          signalStrength: 0,
          confirmedSignals: 0,
        },
      };
    }

    const indicators = new TechnicalIndicators({
      rsiPeriod: this.settings?.rsiPeriod || 14,
      rsiOverbought: this.settings?.rsiOverbought || 70,
      rsiOversold: this.settings?.rsiOversold || 30,
      maShortPeriod: this.settings?.maShortPeriod || 50,
      maLongPeriod: this.settings?.maLongPeriod || 200,
      macdFast: this.settings?.macdFast || 12,
      macdSlow: this.settings?.macdSlow || 26,
      macdSignal: this.settings?.macdSignal || 9,
    });

    const analysis = indicators.analyze(prices);

    const confirmedIndicators: string[] = [];
    if (analysis.rsi.signal !== 'hold') {
      confirmedIndicators.push(`RSI (${analysis.rsi.value.toFixed(1)})`);
    }
    if (analysis.macd.signal !== 'hold') {
      confirmedIndicators.push('MACD');
    }
    if (analysis.maCross.signal !== 'hold') {
      confirmedIndicators.push('MA Cross');
    }

    return {
      symbol,
      timeframe,
      signal: analysis.overallSignal,
      strength: analysis.signalStrength,
      indicators: confirmedIndicators,
      analysis,
    };
  }

  private async analyzeMultiTimeframe(symbol: string, config: AutoTradeConfig): Promise<MultiTimeframeResult> {
    const results: SignalAnalysis[] = [];

    for (const timeframe of config.timeframes) {
      const analysis = await this.analyzeSingleTimeframe(symbol, timeframe);
      results.push(analysis);
      console.log(`${symbol} [${timeframe}]: ${analysis.signal} (${analysis.strength}%) - Indicators: ${analysis.indicators.join(', ') || 'none'}`);
    }

    const buySignals = results.filter(r => r.signal === 'buy').length;
    const sellSignals = results.filter(r => r.signal === 'sell').length;

    let overallSignal: 'buy' | 'sell' | 'hold' = 'hold';
    let confirmedTimeframes = 0;

    // تم تخفيف الشرط: إشارة واحدة كافية للتداول بدلاً من 2
    if (buySignals >= 1) {
      overallSignal = 'buy';
      confirmedTimeframes = buySignals;
    } else if (sellSignals >= 1) {
      overallSignal = 'sell';
      confirmedTimeframes = sellSignals;
    }

    const avgStrength = results
      .filter(r => r.signal === overallSignal)
      .reduce((sum, r) => sum + r.strength, 0) / Math.max(confirmedTimeframes, 1);

    return {
      symbol,
      overallSignal,
      overallStrength: Math.round(avgStrength),
      timeframeResults: results,
      confirmedTimeframes,
    };
  }

  private getConfirmedIndicators(results: SignalAnalysis[]): string[] {
    const allIndicators: string[] = [];
    
    results.forEach(r => {
      r.indicators.forEach(ind => {
        const withTimeframe = `${ind} (${r.timeframe})`;
        if (!allIndicators.includes(withTimeframe)) {
          allIndicators.push(withTimeframe);
        }
      });
    });

    return allIndicators;
  }

  private isInCooldown(symbol: string, cooldownMinutes: number): boolean {
    const lastTrade = this.lastTradeTime[symbol];
    if (!lastTrade) return false;

    const cooldownMs = cooldownMinutes * 60 * 1000;
    return Date.now() - lastTrade < cooldownMs;
  }

  private async executeTrade(
    symbol: string,
    signal: 'buy' | 'sell',
    strength: number,
    indicators: string[],
    config: AutoTradeConfig
  ) {
    try {
      const formattedSymbol = symbol.replace('/', '');
      const marketPrice = await binanceService.getMarketPrice(formattedSymbol);

      if (!marketPrice) {
        console.error(`Could not get market price for ${symbol}`);
        return;
      }

      const isLong = signal === 'buy';
      let stopLoss: number;
      let takeProfit: number;
      let positionSize: number;
      let positionSizeReason: string[] = [];

      // Use Smart Position Sizing if enabled
      if (config.smartPositionSizingEnabled && this.settings) {
        const atrMultiplier = this.settings.atrMultiplier || 1.5;
        const atrResult = await smartPositionSizing.calculateATR(formattedSymbol, this.settings.atrPeriod || 14);
        
        if (atrResult.atr > 0) {
          // Calculate ATR-based stop loss
          stopLoss = smartPositionSizing.calculateATRBasedStopLoss(
            marketPrice.price,
            atrResult.atr,
            atrMultiplier,
            isLong
          );
          
          // Calculate ATR-based take profit
          takeProfit = smartPositionSizing.calculateATRBasedTakeProfit(
            marketPrice.price,
            atrResult.atr,
            config.riskRewardRatio,
            atrMultiplier,
            isLong
          );
          
          // Calculate optimal position size
          const sizeResult = await smartPositionSizing.calculateOptimalPositionSize(
            formattedSymbol,
            marketPrice.price,
            stopLoss,
            strength
          );
          
          positionSize = sizeResult.recommendedSize;
          positionSizeReason = sizeResult.adjustmentReason;
          
          console.log(`[SMART] ${symbol}: ATR=${atrResult.atr.toFixed(2)}, Volatility=${atrResult.volatilityLevel}, Size=${positionSize.toFixed(4)} (${sizeResult.sizePercent}%)`);
        } else {
          // Fallback to traditional calculation
          stopLoss = binanceService.calculateStopLoss(marketPrice.price, isLong, config.maxRiskPerTrade);
          takeProfit = binanceService.calculateTakeProfit(marketPrice.price, stopLoss, isLong, config.riskRewardRatio);
          const accountInfo = await binanceService.getAccountInfo();
          const balance = accountInfo?.availableBalance || 1000;
          positionSize = binanceService.calculatePositionSize(balance, config.maxRiskPerTrade, marketPrice.price, stopLoss, 10);
        }
      } else {
        // Traditional calculation
        stopLoss = binanceService.calculateStopLoss(marketPrice.price, isLong, config.maxRiskPerTrade);
        takeProfit = binanceService.calculateTakeProfit(marketPrice.price, stopLoss, isLong, config.riskRewardRatio);
        const accountInfo = await binanceService.getAccountInfo();
        const balance = accountInfo?.availableBalance || 1000;
        positionSize = binanceService.calculatePositionSize(balance, config.maxRiskPerTrade, marketPrice.price, stopLoss, 10);
      }

      if (positionSize <= 0) {
        console.error('Invalid position size calculated');
        return;
      }

      const order = await binanceService.placeOrder(
        formattedSymbol,
        isLong ? 'BUY' : 'SELL',
        positionSize,
        stopLoss,
        takeProfit,
        10
      );

      if (!order) {
        await storage.createLog({
          level: 'error',
          message: `فشل تنفيذ صفقة تلقائية ${symbol}`,
          details: `إشارة: ${signal}, قوة: ${strength}%`,
        });
        return;
      }

      const trade = await storage.createTrade({
        symbol: formattedSymbol,
        type: isLong ? 'long' : 'short',
        status: 'active',
        entryPrice: order.price || marketPrice.price,
        quantity: order.quantity || positionSize,
        leverage: 10,
        stopLoss,
        takeProfit,
        entrySignals: indicators,
        binanceOrderId: order.orderId,
        isAutoTrade: true,
        trailingStopActive: config.trailingStopEnabled,
        highestPrice: 0, // Initialize to 0, will store highest profit % when trailing stop activates
        lowestPrice: 0,  // Initialize to 0, will store highest profit % for SHORT trades
      });

      this.lastTradeTime[formattedSymbol] = Date.now();
      this.dailyTradeCount++;

      await storage.createLog({
        level: 'success',
        message: `تم تنفيذ صفقة تلقائية ${isLong ? 'شراء' : 'بيع'} ${symbol}`,
        details: `سعر: $${marketPrice.price.toFixed(2)}, قوة الإشارة: ${strength}%`,
      });

      if (telegramService.isConfigured()) {
        await telegramService.notifyTradeOpen(trade, marketPrice.price);
      }

      console.log(`Auto trade executed: ${signal} ${symbol} at $${marketPrice.price}`);
    } catch (error) {
      console.error(`Failed to execute auto trade for ${symbol}:`, error);
      await storage.createLog({
        level: 'error',
        message: `خطأ في التداول التلقائي ${symbol}`,
        details: String(error),
      });
    }
  }

  private async executeTradeWithLevels(
    symbol: string,
    signal: 'buy' | 'sell',
    strength: number,
    indicators: string[],
    config: AutoTradeConfig,
    levels: { entry: number; stopLoss: number; takeProfit: number }
  ) {
    try {
      const formattedSymbol = symbol.replace('/', '');
      const marketPrice = await binanceService.getMarketPrice(formattedSymbol);

      if (!marketPrice) {
        console.error(`Could not get market price for ${symbol}`);
        return;
      }

      const isLong = signal === 'buy';
      const { stopLoss, takeProfit } = levels;

      let positionSize: number;

      // Use Smart Position Sizing if enabled
      if (config.smartPositionSizingEnabled) {
        const sizeResult = await smartPositionSizing.calculateOptimalPositionSize(
          formattedSymbol,
          marketPrice.price,
          stopLoss,
          strength
        );
        positionSize = sizeResult.recommendedSize;
        console.log(`[SMART-LEVELS] ${symbol}: Size=${positionSize.toFixed(4)} (${sizeResult.sizePercent}%), Reasons: ${sizeResult.adjustmentReason.join(', ')}`);
      } else {
        // Traditional calculation
        const accountInfo = await binanceService.getAccountInfo();
        const balance = accountInfo?.availableBalance || 1000;
        positionSize = binanceService.calculatePositionSize(
          balance,
          config.maxRiskPerTrade,
          marketPrice.price,
          stopLoss,
          10
        );
      }

      if (positionSize <= 0) {
        console.error('Invalid position size calculated');
        return;
      }

      const order = await binanceService.placeOrder(
        formattedSymbol,
        isLong ? 'BUY' : 'SELL',
        positionSize,
        stopLoss,
        takeProfit,
        10
      );

      if (!order) {
        await storage.createLog({
          level: 'error',
          message: `فشل تنفيذ صفقة استراتيجية ${symbol}`,
          details: `إشارة: ${signal}, قوة: ${strength}%`,
        });
        return;
      }

      const trade = await storage.createTrade({
        symbol: formattedSymbol,
        type: isLong ? 'long' : 'short',
        status: 'active',
        entryPrice: order.price || marketPrice.price,
        quantity: order.quantity || positionSize,
        leverage: 10,
        stopLoss,
        takeProfit,
        entrySignals: indicators,
        binanceOrderId: order.orderId,
        isAutoTrade: true,
        trailingStopActive: config.trailingStopEnabled,
        highestPrice: 0,
        lowestPrice: 0,
      });

      this.lastTradeTime[formattedSymbol] = Date.now();
      this.dailyTradeCount++;

      await storage.createLog({
        level: 'success',
        message: `تم تنفيذ صفقة استراتيجية ${isLong ? 'شراء' : 'بيع'} ${symbol}`,
        details: `سعر: $${marketPrice.price.toFixed(2)}, وقف: $${stopLoss.toFixed(2)}, هدف: $${takeProfit.toFixed(2)}`,
      });

      if (telegramService.isConfigured()) {
        await telegramService.notifyTradeOpen(trade, marketPrice.price);
      }

      console.log(`Strategy trade executed: ${signal} ${symbol} at $${marketPrice.price} (SL: $${stopLoss.toFixed(2)}, TP: $${takeProfit.toFixed(2)})`);
    } catch (error) {
      console.error(`Failed to execute strategy trade for ${symbol}:`, error);
      await storage.createLog({
        level: 'error',
        message: `خطأ في تنفيذ صفقة استراتيجية ${symbol}`,
        details: String(error),
      });
    }
  }

  private async updateTrailingStops(config: AutoTradeConfig) {
    if (!config.trailingStopEnabled) {
      console.log('Trailing stop is DISABLED in settings');
      return;
    }

    const activeTrades = await storage.getTrades('active');
    const tradesWithTrailing = activeTrades.filter(t => t.trailingStopActive);

    console.log(`=== TRAILING STOP CHECK: ${tradesWithTrailing.length} trades with trailing stop enabled ===`);

    for (const trade of tradesWithTrailing) {
      try {
        await this.updateTrailingStopForTrade(trade, config);
      } catch (error) {
        console.error(`Error updating trailing stop for trade ${trade.id}:`, error);
      }
    }
  }

  private async updateTrailingStopForTrade(trade: Trade, config: AutoTradeConfig) {
    const formattedSymbol = trade.symbol.replace('/', '');
    const marketPrice = await binanceService.getMarketPrice(formattedSymbol);

    if (!marketPrice) return;

    const currentPrice = marketPrice.price;
    const isLong = trade.type === 'long';
    
    // Get actual position data from Binance for accurate profit calculation
    // This handles cases where entry price changed due to averaging, DCA, or manual additions
    let actualEntryPrice = trade.entryPrice;
    let actualProfitPercent: number;
    
    try {
      const accountInfo = await binanceService.getAccountInfo();
      const positionSide = isLong ? 'LONG' : 'SHORT';
      const position = accountInfo?.positions?.find(
        (p: any) => p.symbol === formattedSymbol && p.side === positionSide && Math.abs(p.quantity) > 0
      );
      
      if (position) {
        actualEntryPrice = position.entryPrice;
        // Calculate profit using Binance's unrealizedPnl for accuracy
        const positionValue = actualEntryPrice * Math.abs(position.quantity);
        actualProfitPercent = positionValue > 0 ? (position.unrealizedPnl / positionValue) * 100 : 0;
      } else {
        // Fallback to database calculation if position not found
        actualProfitPercent = isLong
          ? ((currentPrice - trade.entryPrice) / trade.entryPrice) * 100
          : ((trade.entryPrice - currentPrice) / trade.entryPrice) * 100;
      }
    } catch (error) {
      // Fallback to database calculation on error
      actualProfitPercent = isLong
        ? ((currentPrice - trade.entryPrice) / trade.entryPrice) * 100
        : ((trade.entryPrice - currentPrice) / trade.entryPrice) * 100;
    }
    
    const profitPercent = actualProfitPercent;

    // Track highest profit achieved
    // We use highestPrice to store highest profit % for this new system
    // Note: If highestPrice looks like a price (> 50), reset it to 0 (legacy data cleanup)
    const storedValue = trade.highestPrice || 0;
    const previousHighestProfit = storedValue > 50 ? 0 : storedValue; // Reset if looks like a price
    const currentHighestProfit = Math.max(previousHighestProfit, profitPercent);

    console.log(`[TS] ${trade.symbol} ${trade.type.toUpperCase()}: Entry $${actualEntryPrice.toFixed(4)}, Current $${currentPrice.toFixed(4)}, Profit ${profitPercent.toFixed(2)}%, HighestProfit ${currentHighestProfit.toFixed(2)}%, TrailingStop: ${trade.trailingStopPrice ? '$' + trade.trailingStopPrice.toFixed(4) : 'null'}`);

    // Check if trailing stop has been activated before
    const hasTrailingStop = trade.trailingStopPrice && trade.trailingStopPrice > 0;

    // If trailing stop is active, check if price hit it - close the trade
    if (hasTrailingStop) {
      const stopHit = isLong 
        ? currentPrice <= trade.trailingStopPrice!
        : currentPrice >= trade.trailingStopPrice!;

      if (stopHit) {
        console.log(`Trailing stop HIT for ${trade.symbol}: Price $${currentPrice}, Stop $${trade.trailingStopPrice}`);
        await this.closeTradeByTrailingStop(trade, currentPrice, profitPercent);
        return;
      }
    }

    // Only activate trailing stop if:
    // 1. No existing trailing stop AND profit is below threshold - skip
    // 2. Has existing trailing stop OR profit is above threshold - continue
    // This ensures we always recalculate based on highest profit, even if current profit drops
    const hasExistingTrailingStop = trade.trailingStopPrice && trade.trailingStopPrice > 0;
    if (!hasExistingTrailingStop && profitPercent < config.trailingStopActivationPercent) {
      return;
    }

    // PROFIT-BASED TRAILING STOP SYSTEM
    // The stop is calculated to lock in profits based on profit percentage, not price
    // 
    // Example for LONG with trailingStopPercent = 2%:
    // - Entry: $100, Current: $105 (5% profit)
    // - Stop = Entry × (1 + (HighestProfit - TrailPercent)/100)
    // - Stop = $100 × (1 + (5 - 2)/100) = $100 × 1.03 = $103 (locks in 3% profit)
    //
    // If price rises to $110 (10% profit):
    // - Stop = $100 × (1 + (10 - 2)/100) = $100 × 1.08 = $108 (locks in 8% profit)
    //
    // If price drops to $107, stop STAYS at $108 (ratchet never goes down)

    const existingTrailingStop = trade.trailingStopPrice;
    let newStopLoss: number;
    let stopUpdated = false;

    // Calculate locked profit percentage (highest profit minus trail distance)
    const lockedProfitPercent = currentHighestProfit - config.trailingStopPercent;
    
    if (isLong) {
      // LONG: Stop = Entry × (1 + lockedProfit%)
      // This sets stop above entry price to lock in profits
      const calculatedStop = actualEntryPrice * (1 + lockedProfitPercent / 100);
      
      if (!existingTrailingStop) {
        // FIRST ACTIVATION
        newStopLoss = calculatedStop;
        stopUpdated = true;
        console.log(`LONG ${trade.symbol}: First trailing stop at $${newStopLoss.toFixed(4)} (locking ${lockedProfitPercent.toFixed(2)}% profit)`);
      } else {
        // RATCHET: Only move stop UP, NEVER down
        if (calculatedStop > existingTrailingStop) {
          newStopLoss = calculatedStop;
          stopUpdated = true;
          console.log(`LONG ${trade.symbol}: Trailing stop UP $${existingTrailingStop.toFixed(4)} -> $${newStopLoss.toFixed(4)} (locking ${lockedProfitPercent.toFixed(2)}% profit)`);
        } else {
          newStopLoss = existingTrailingStop;
        }
      }
    } else {
      // SHORT: Stop = Entry × (1 - lockedProfit%)
      // This sets stop below entry price to lock in profits
      const calculatedStop = actualEntryPrice * (1 - lockedProfitPercent / 100);
      
      if (!existingTrailingStop) {
        // FIRST ACTIVATION
        newStopLoss = calculatedStop;
        stopUpdated = true;
        console.log(`SHORT ${trade.symbol}: First trailing stop at $${newStopLoss.toFixed(4)} (locking ${lockedProfitPercent.toFixed(2)}% profit)`);
      } else {
        // RATCHET: Only move stop DOWN, NEVER up
        if (calculatedStop < existingTrailingStop) {
          newStopLoss = calculatedStop;
          stopUpdated = true;
          console.log(`SHORT ${trade.symbol}: Trailing stop DOWN $${existingTrailingStop.toFixed(4)} -> $${newStopLoss.toFixed(4)} (locking ${lockedProfitPercent.toFixed(2)}% profit)`);
        } else {
          newStopLoss = existingTrailingStop;
        }
      }
    }

    // Track highest profit achieved (stored in highestPrice field)
    const highestProfitChanged = currentHighestProfit !== previousHighestProfit;
    
    if (stopUpdated || highestProfitChanged) {
      // Update database - store highest profit in highestPrice field
      await storage.updateTradeTrailingStop(trade.id, {
        stopLoss: newStopLoss,
        highestPrice: currentHighestProfit, // Store highest profit %, not price
        lowestPrice: trade.lowestPrice || 0,
        trailingStopPrice: newStopLoss,
      });

      if (stopUpdated) {
        // CRITICAL: Also update the stop loss order on Binance!
        // This ensures the actual exchange order is moved to the new trailing stop price
        const positionSide = isLong ? 'LONG' : 'SHORT';
        const binanceUpdated = await binanceService.updateStopLossOrder(
          trade.symbol,
          positionSide,
          trade.quantity,
          newStopLoss
        );
        
        if (!binanceUpdated) {
          console.error(`Failed to update stop loss order on Binance for ${trade.symbol}`);
        }

        const lockedProfitPercent = currentHighestProfit - config.trailingStopPercent;
        await storage.createLog({
          level: 'info',
          message: `تحديث وقف الخسارة المتحرك ${trade.symbol}`,
          details: `وقف جديد: $${newStopLoss.toFixed(4)} (أعلى ربح: ${currentHighestProfit.toFixed(2)}%، ربح محمي: ${lockedProfitPercent.toFixed(2)}%) - تم تحديث أمر Binance: ${binanceUpdated ? 'نعم' : 'لا'}`,
        });

        if (telegramService.isConfigured()) {
          const updatedTrade = { ...trade, stopLoss: newStopLoss };
          await telegramService.notifyTrailingStopUpdate(updatedTrade, newStopLoss);
        }

        console.log(`Trailing stop updated for ${trade.symbol}: $${(existingTrailingStop || trade.stopLoss).toFixed(4)} -> $${newStopLoss.toFixed(4)} (Binance updated: ${binanceUpdated})`);
      }
    }
  }

  private async closeTradeByTrailingStop(trade: Trade, exitPrice: number, profitPercent: number) {
    try {
      const formattedSymbol = trade.symbol.replace('/', '');
      const isLong = trade.type === 'long';
      
      // Auto-detect hedging mode from Binance account (not from settings)
      const hedgingMode = await binanceService.getPositionMode();
      console.log(`Closing ${trade.symbol} with hedging mode: ${hedgingMode}`);
      
      // Close position on Binance
      const closeOrder = await binanceService.closePosition(
        formattedSymbol,
        isLong ? 'LONG' : 'SHORT',
        trade.quantity,
        hedgingMode
      );

      if (!closeOrder) {
        console.error(`Failed to close position for ${trade.symbol} by trailing stop`);
        return;
      }

      // Calculate profit
      const profit = isLong
        ? (exitPrice - trade.entryPrice) * trade.quantity
        : (trade.entryPrice - exitPrice) * trade.quantity;

      // Update trade in database
      await storage.closeTrade(trade.id, exitPrice, profit, profitPercent);

      // Record trade result for account protection
      marketFilter.recordTradeResult(profit);

      await storage.createLog({
        level: 'success',
        message: `تم إغلاق صفقة ${trade.symbol} بوقف الخسارة المتحرك`,
        details: `ربح: $${profit.toFixed(2)} (${profitPercent.toFixed(2)}%)`,
      });

      if (telegramService.isConfigured()) {
        const closedTrade = { ...trade, exitPrice, profit, profitPercent };
        await telegramService.notifyTradeClose(closedTrade);
      }

      console.log(`Trade closed by trailing stop: ${trade.symbol} at $${exitPrice}, Profit: $${profit.toFixed(2)}`);
    } catch (error) {
      console.error(`Error closing trade by trailing stop:`, error);
      await storage.createLog({
        level: 'error',
        message: `خطأ في إغلاق صفقة ${trade.symbol} بوقف الخسارة المتحرك`,
        details: String(error),
      });
    }
  }

  // Sync trades with Binance positions - detect closed positions and add manual trades
  private async syncTradesWithBinance() {
    try {
      const activeTrades = await storage.getTrades('active');
      const accountInfo = await binanceService.getAccountInfo();
      
      if (!accountInfo || !accountInfo.positions) return;

      const binancePositions = new Map<string, any>();
      for (const pos of accountInfo.positions) {
        const key = `${pos.symbol}_${pos.side}`;
        binancePositions.set(key, pos);
      }

      // Create a set of tracked positions for quick lookup
      const trackedPositions = new Set<string>();
      for (const trade of activeTrades) {
        const side = trade.type === 'long' ? 'LONG' : 'SHORT';
        trackedPositions.add(`${trade.symbol}_${side}`);
      }

      // 1. Detect closed positions (positions in DB but not on Binance)
      for (const trade of activeTrades) {
        const side = trade.type === 'long' ? 'LONG' : 'SHORT';
        const key = `${trade.symbol}_${side}`;
        
        const position = binancePositions.get(key);
        
        // If position doesn't exist on Binance or quantity is 0, it was closed
        if (!position || Math.abs(position.quantity) === 0) {
          console.log(`Position ${trade.symbol} ${side} not found on Binance - marking as closed`);
          
          // Get last known price
          const marketPrice = await binanceService.getMarketPrice(trade.symbol);
          const exitPrice = marketPrice?.price || trade.entryPrice;
          
          const isLong = trade.type === 'long';
          const profit = isLong
            ? (exitPrice - trade.entryPrice) * trade.quantity
            : (trade.entryPrice - exitPrice) * trade.quantity;
          
          const profitPercent = isLong
            ? ((exitPrice - trade.entryPrice) / trade.entryPrice) * 100
            : ((trade.entryPrice - exitPrice) / trade.entryPrice) * 100;

          await storage.closeTrade(trade.id, exitPrice, profit, profitPercent);

          // Record trade result for account protection
          marketFilter.recordTradeResult(profit);

          await storage.createLog({
            level: 'info',
            message: `تم اكتشاف إغلاق صفقة ${trade.symbol}`,
            details: `ربح/خسارة: $${profit.toFixed(2)} (${profitPercent.toFixed(2)}%)`,
          });
        }
      }

      // 2. Detect manual positions (positions on Binance but not in DB)
      const positionEntries = Array.from(binancePositions.entries());
      const settings = await storage.getSettings();
      
      for (const [key, position] of positionEntries) {
        // Parse Binance fields to numbers (they can come as strings from API)
        const entryPrice = parseFloat(String(position.entryPrice)) || 0;
        const quantity = Math.abs(parseFloat(String(position.quantity)) || 0);
        const leverage = parseInt(String(position.leverage), 10) || 10;
        
        if (!trackedPositions.has(key) && quantity > 0 && entryPrice > 0) {
          console.log(`Manual position detected: ${position.symbol} ${position.side} - adding to database`);
          
          const trailingStopEnabled = settings?.trailingStopEnabled || false;
          const maxRiskPercent = settings?.maxRiskPerTrade || 2;
          const riskRewardRatio = settings?.riskRewardRatio || 1.5;
          
          const isLong = position.side === 'LONG';
          const stopLossPercent = maxRiskPercent;
          const takeProfitPercent = maxRiskPercent * riskRewardRatio;
          
          const stopLoss = isLong
            ? entryPrice * (1 - stopLossPercent / 100)
            : entryPrice * (1 + stopLossPercent / 100);
          
          const takeProfit = isLong
            ? entryPrice * (1 + takeProfitPercent / 100)
            : entryPrice * (1 - takeProfitPercent / 100);

          await storage.createTrade({
            symbol: position.symbol,
            type: isLong ? 'long' : 'short',
            entryPrice,
            quantity,
            stopLoss,
            takeProfit,
            leverage,
            entrySignals: ['Manual Trade'],
            binanceOrderId: 'manual',
            trailingStopActive: trailingStopEnabled,
            highestPrice: 0, // Initialize to 0, will store highest profit % when tracking starts
            lowestPrice: 0,  // Initialize to 0, will store highest profit % for SHORT trades
            isAutoTrade: false,
          });

          await storage.createLog({
            level: 'success',
            message: `تم إضافة صفقة يدوية ${position.symbol} ${position.side}`,
            details: `سعر الدخول: $${entryPrice.toFixed(4)}, الكمية: ${quantity}, الرافعة: ${leverage}x`,
          });

          console.log(`Manual trade added: ${position.symbol} ${position.side} at $${entryPrice}`);
        }
      }
    } catch (error) {
      console.error('Error syncing trades with Binance:', error);
    }
  }
}

export const autoTrader = new AutoTrader();
