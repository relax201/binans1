import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import fs from "fs";
import path from "path";

// Debug logging helper
const DEBUG_LOG_PATH = path.resolve(process.cwd(), ".cursor", "debug.log");
function debugLog(location: string, message: string, data: any = {}, hypothesisId: string = "") {
  try {
    const logEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      location,
      message,
      data,
      sessionId: "debug-session",
      runId: "startup",
      hypothesisId,
    };
    const logLine = JSON.stringify(logEntry) + "\n";
    fs.appendFileSync(DEBUG_LOG_PATH, logLine, "utf8");
  } catch (error) {
    // Silently fail if logging fails
  }
}
import { binanceService } from "./services/binance";
import { TechnicalIndicators } from "./services/technical-indicators";
import { telegramService } from "./services/telegram";
import { emailService } from "./services/email";
import { autoTrader } from "./services/auto-trader";
import { aiPredictor } from "./services/ai-predictor";
import { marketFilter } from "./services/market-filter";
import { insertBotSettingsSchema, insertTradeSchema, insertActivityLogSchema } from "@shared/schema";
import { z } from "zod";
import { wsManager } from "./websocket";
import { AdvancedStatsCalculator } from "./services/advanced-stats";

const DEFAULT_TRADING_PAIRS = [
  'BTC/USDT',
  'ETH/USDT',
  'BNB/USDT',
  'SOL/USDT',
  'XRP/USDT',
  'ADA/USDT',
  'DOGE/USDT',
  'LINK/USDT',
  'AVAX/USDT',
  'LTC/USDT',
  'DOT/USDT',
];

function normalizeTradingPair(input: string): string {
  const s = input.trim().toUpperCase();
  if (!s) return s;
  if (s.includes("/")) return s;

  const m = s.match(/^(.*?)(USDT|BUSD|USDC|BTC|ETH)$/);
  if (!m) return s;
  const base = m[1];
  const quote = m[2];
  if (!base || !quote) return s;
  return `${base}/${quote}`;
}

function mergeTradingPairs(existing: unknown): { merged: string[]; changed: boolean } {
  const existingArr = Array.isArray(existing) ? existing : [];
  const normalizedExisting = existingArr
    .filter((p): p is string => typeof p === "string")
    .map(normalizeTradingPair)
    .filter(Boolean);

  const seen = new Set<string>();
  const merged: string[] = [];

  for (const p of normalizedExisting) {
    if (!seen.has(p)) {
      seen.add(p);
      merged.push(p);
    }
  }

  for (const p of DEFAULT_TRADING_PAIRS) {
    if (!seen.has(p)) {
      seen.add(p);
      merged.push(p);
    }
  }

  const changed =
    merged.length !== normalizedExisting.length ||
    merged.some((p, i) => normalizedExisting[i] !== p);

  return { merged, changed };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // #region agent log
  debugLog('server/routes.ts:14', 'registerRoutes function started', {}, 'B');
  // #endregion

  app.get("/api/settings", async (req, res) => {
    try {
      let settings = await storage.getSettings();
      
      if (!settings) {
        settings = await storage.createSettings({
          isTestnet: true,
          isActive: false,
          hedgingMode: false,
          maxRiskPerTrade: 2,
          riskRewardRatio: 1.5,
          maShortPeriod: 50,
          maLongPeriod: 200,
          rsiPeriod: 14,
          rsiOverbought: 70,
          rsiOversold: 30,
          macdFast: 12,
          macdSlow: 26,
          macdSignal: 9,
          tradingPairs: DEFAULT_TRADING_PAIRS,
          timeframes: ['15m', '1h', '4h'],
          enabledStrategies: ['breakout', 'momentum', 'meanReversion', 'swing'],
          emailNotifications: false,
        });
      } else {
        const { merged, changed } = mergeTradingPairs(settings.tradingPairs);
        if (changed) {
          const updated = await storage.updateSettings(settings.id, { tradingPairs: merged });
          if (updated) {
            settings = updated;
            await wsManager.broadcastSettings(updated);
            autoTrader.updateSettings(updated);
          }
        }
      }
      
      res.json(settings);
    } catch (error) {
      console.error("Failed to get settings:", error);
      res.status(500).json({ error: "Failed to get settings" });
    }
  });

  app.put("/api/settings", async (req, res) => {
    try {
      const parseResult = insertBotSettingsSchema.partial().safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: "Invalid settings data", details: parseResult.error });
      }

      const settings = await storage.getSettings();
      
      if (!settings) {
        const newSettings = await storage.createSettings(req.body);
        binanceService.updateSettings(newSettings);
        autoTrader.updateSettings(newSettings);
        await wsManager.broadcastSettings(newSettings);
        res.json(newSettings);
      } else {
        const updatedSettings = await storage.updateSettings(settings.id, parseResult.data);
        if (updatedSettings) {
          binanceService.updateSettings(updatedSettings);
          autoTrader.updateSettings(updatedSettings);
          await wsManager.broadcastSettings(updatedSettings);

          if (!settings.trailingStopEnabled && updatedSettings.trailingStopEnabled) {
            const activeTrades = await storage.getTrades("active");
            for (const trade of activeTrades) {
              if (!trade.trailingStopActive) {
                const updatedTrade = await storage.updateTrade(trade.id, { trailingStopActive: true });
                if (updatedTrade) {
                  await wsManager.broadcastTradeUpdate(updatedTrade);
                }
              }
            }
          }
        }
        res.json(updatedSettings);
      }
      
      await storage.createLog({
        level: 'info',
        message: 'تم تحديث إعدادات الروبوت',
      });
    } catch (error) {
      console.error("Failed to update settings:", error);
      res.status(500).json({ error: "Failed to update settings" });
    }
  });

  app.post("/api/bot/toggle", async (req, res) => {
    try {
      const settings = await storage.getSettings();
      
      if (!settings) {
        return res.status(404).json({ error: "Settings not found" });
      }
      
      const updatedSettings = await storage.updateSettings(settings.id, {
        isActive: !settings.isActive,
      });
      
      const logEntry = await storage.createLog({
        level: 'success',
        message: updatedSettings?.isActive ? 'تم تفعيل الروبوت' : 'تم إيقاف الروبوت',
      });
      
      // Broadcast via WebSocket
      if (updatedSettings) {
        await wsManager.broadcastSettings(updatedSettings);
      }
      if (logEntry) {
        await wsManager.broadcastLog(logEntry);
      }
      
      res.json(updatedSettings);
    } catch (error) {
      console.error("Failed to toggle bot:", error);
      res.status(500).json({ error: "Failed to toggle bot" });
    }
  });

  app.post("/api/test-connection", async (req, res) => {
    try {
      const settings = await storage.getSettings();
      
      if (settings) {
        binanceService.updateSettings(settings);
      }
      
      const isConnected = await binanceService.testConnection();
      
      await storage.createLog({
        level: isConnected ? 'success' : 'error',
        message: isConnected ? 'تم الاتصال بـ Binance API بنجاح' : 'فشل الاتصال بـ Binance API',
      });
      
      if (isConnected) {
        res.json({ success: true });
      } else {
        res.status(400).json({ error: "Connection failed" });
      }
    } catch (error) {
      console.error("Connection test failed:", error);
      res.status(500).json({ error: "Connection test failed" });
    }
  });

  app.get("/api/trades", async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const trades = await storage.getTrades(status);
      res.json(trades);
    } catch (error) {
      console.error("Failed to get trades:", error);
      res.status(500).json({ error: "Failed to get trades" });
    }
  });

  app.get("/api/trades/active", async (req, res) => {
    try {
      const trades = await storage.getTrades('active');
      res.json(trades);
    } catch (error) {
      console.error("Failed to get active trades:", error);
      res.status(500).json({ error: "Failed to get active trades" });
    }
  });

  app.get("/api/trades/history", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const trades = await storage.getTradeHistory(limit);
      res.json(trades);
    } catch (error) {
      console.error("Failed to get trade history:", error);
      res.status(500).json({ error: "Failed to get trade history" });
    }
  });

  app.get("/api/trades/:id", async (req, res) => {
    try {
      const trade = await storage.getTradeById(req.params.id);
      
      if (!trade) {
        return res.status(404).json({ error: "Trade not found" });
      }
      
      res.json(trade);
    } catch (error) {
      console.error("Failed to get trade:", error);
      res.status(500).json({ error: "Failed to get trade" });
    }
  });

  app.post("/api/trades", async (req, res) => {
    try {
      const parseResult = insertTradeSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: "Invalid trade data", details: parseResult.error });
      }

      const settings = await storage.getSettings();
      let trade = await storage.createTrade(parseResult.data);
      if (settings?.trailingStopEnabled && !trade.trailingStopActive) {
        const updatedTrade = await storage.updateTrade(trade.id, { trailingStopActive: true });
        if (updatedTrade) {
          trade = updatedTrade;
        }
      }
      
      const logEntry = await storage.createLog({
        level: 'success',
        message: `تم فتح صفقة ${trade.type === 'long' ? 'شراء' : 'بيع'} ${trade.symbol}`,
        details: `سعر الدخول: $${trade.entryPrice}`,
      });
      
      // Broadcast via WebSocket
      await wsManager.broadcastNewTrade(trade);
      if (logEntry) {
        await wsManager.broadcastLog(logEntry);
      }
      
      res.json(trade);
    } catch (error) {
      console.error("Failed to create trade:", error);
      res.status(500).json({ error: "Failed to create trade" });
    }
  });

  app.post("/api/trades/:id/close", async (req, res) => {
    try {
      const trade = await storage.getTradeById(req.params.id);
      
      if (!trade) {
        return res.status(404).json({ error: "Trade not found" });
      }
      
      if (trade.status !== 'active') {
        return res.status(400).json({ error: "Trade is not active" });
      }
      
      // Get settings for hedging mode
      const settings = await storage.getSettings();
      const hedgingMode = settings?.hedgingMode ?? true;
      
      const isLong = trade.type === 'long';
      const formattedSymbol = trade.symbol.replace('/', '');
      
      // Actually close the position on Binance
      const closeOrder = await binanceService.closePosition(
        formattedSymbol,
        isLong ? 'LONG' : 'SHORT',
        trade.quantity,
        hedgingMode
      );
      
      if (!closeOrder) {
        return res.status(500).json({ error: "Failed to close position on Binance" });
      }
      
      const marketPrice = await binanceService.getMarketPrice(trade.symbol);
      const exitPrice = marketPrice?.price || trade.entryPrice;
      
      const priceDiff = isLong 
        ? exitPrice - trade.entryPrice 
        : trade.entryPrice - exitPrice;
      
      const profit = priceDiff * trade.quantity * (trade.leverage || 1);
      const profitPercent = (priceDiff / trade.entryPrice) * 100;
      
      const closedTrade = await storage.closeTrade(
        trade.id,
        exitPrice,
        profit,
        profitPercent
      );

      // Record trade result for account protection
      marketFilter.recordTradeResult(profit);
      
      const logEntry = await storage.createLog({
        level: profit >= 0 ? 'success' : 'warning',
        message: `تم إغلاق صفقة ${trade.symbol}`,
        details: `${profit >= 0 ? 'ربح' : 'خسارة'}: ${profit >= 0 ? '+' : ''}$${profit.toFixed(2)} (${profitPercent >= 0 ? '+' : ''}${profitPercent.toFixed(2)}%)`,
      });
      
      // Broadcast via WebSocket
      if (closedTrade) {
        await wsManager.broadcastTradeClosed(closedTrade);
      }
      if (logEntry) {
        await wsManager.broadcastLog(logEntry);
      }
      
      res.json(closedTrade);
    } catch (error) {
      console.error("Failed to close trade:", error);
      res.status(500).json({ error: "Failed to close trade" });
    }
  });

  app.post("/api/trades/close-all", async (req, res) => {
    try {
      const activeTrades = await storage.getTrades('active');
      const settings = await storage.getSettings();
      const hedgingMode = settings?.hedgingMode ?? true;
      let closedCount = 0;
      
      for (const trade of activeTrades) {
        const isLong = trade.type === 'long';
        const formattedSymbol = trade.symbol.replace('/', '');
        
        // Actually close the position on Binance
        const closeOrder = await binanceService.closePosition(
          formattedSymbol,
          isLong ? 'LONG' : 'SHORT',
          trade.quantity,
          hedgingMode
        );
        
        if (!closeOrder) {
          console.error(`Failed to close position for ${trade.symbol} on Binance`);
          continue;
        }
        
        const marketPrice = await binanceService.getMarketPrice(trade.symbol);
        const exitPrice = marketPrice?.price || trade.entryPrice;
        
        const priceDiff = isLong 
          ? exitPrice - trade.entryPrice 
          : trade.entryPrice - exitPrice;
        
        const profit = priceDiff * trade.quantity * (trade.leverage || 1);
        const profitPercent = (priceDiff / trade.entryPrice) * 100;
        
        await storage.closeTrade(trade.id, exitPrice, profit, profitPercent);
        
        // Record trade result for account protection
        marketFilter.recordTradeResult(profit);
        
        closedCount++;
      }
      
      await storage.createLog({
        level: 'warning',
        message: 'تم إغلاق جميع الصفقات النشطة',
        details: `عدد الصفقات المغلقة: ${closedCount}`,
      });
      
      res.json({ success: true, closedCount });
    } catch (error) {
      console.error("Failed to close all trades:", error);
      res.status(500).json({ error: "Failed to close all trades" });
    }
  });

  app.get("/api/logs", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const logs = await storage.getLogs(limit);
      res.json(logs);
    } catch (error) {
      console.error("Failed to get logs:", error);
      res.status(500).json({ error: "Failed to get logs" });
    }
  });

  app.get("/api/logs/recent", async (req, res) => {
    try {
      const logs = await storage.getLogs(10);
      res.json(logs);
    } catch (error) {
      console.error("Failed to get recent logs:", error);
      res.status(500).json({ error: "Failed to get recent logs" });
    }
  });

  app.post("/api/logs", async (req, res) => {
    try {
      const parseResult = insertActivityLogSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: "Invalid log data", details: parseResult.error });
      }
      
      const log = await storage.createLog(parseResult.data);
      res.json(log);
    } catch (error) {
      console.error("Failed to create log:", error);
      res.status(500).json({ error: "Failed to create log" });
    }
  });

  app.get("/api/account", async (req, res) => {
    try {
      const settings = await storage.getSettings();
      
      if (!settings?.binanceApiKey || !settings?.binanceApiSecret) {
        return res.json({ 
          connected: false,
          error: 'no_credentials',
          message: 'لم يتم تكوين مفاتيح API',
          totalBalance: 0,
          availableBalance: 0,
          positions: []
        });
      }
      
      binanceService.updateSettings(settings);
      const accountInfo = await binanceService.getAccountInfo();
      
      if (!accountInfo) {
        return res.json({ 
          connected: false,
          error: 'connection_failed',
          message: 'فشل الاتصال بـ Binance - قد يكون الخادم محظوراً من هذا الموقع',
          totalBalance: 0,
          availableBalance: 0,
          positions: []
        });
      }
      
      res.json({
        connected: true,
        ...accountInfo
      });
    } catch (error) {
      console.error("Failed to get account info:", error);
      res.json({ 
        connected: false,
        error: 'unknown_error',
        message: 'حدث خطأ غير متوقع',
        totalBalance: 0,
        availableBalance: 0,
        positions: []
      });
    }
  });

  app.get("/api/stats/summary", async (req, res) => {
    try {
      const stats = await storage.getStats();
      
      const settings = await storage.getSettings();
      if (settings?.binanceApiKey && settings?.binanceApiSecret) {
        binanceService.updateSettings(settings);
        const accountInfo = await binanceService.getAccountInfo();
        if (accountInfo) {
          stats.totalBalance = accountInfo.totalBalance;
        }
      }
      
      res.json(stats);
    } catch (error) {
      console.error("Failed to get stats:", error);
      res.status(500).json({ error: "Failed to get stats" });
    }
  });

  app.get("/api/stats", async (req, res) => {
    try {
      const stats = await storage.getStats();
      
      const settings = await storage.getSettings();
      if (settings?.binanceApiKey && settings?.binanceApiSecret) {
        binanceService.updateSettings(settings);
        const accountInfo = await binanceService.getAccountInfo();
        if (accountInfo) {
          stats.totalBalance = accountInfo.totalBalance;
        }
      }
      
      res.json(stats);
    } catch (error) {
      console.error("Failed to get stats:", error);
      res.status(500).json({ error: "Failed to get stats" });
    }
  });

  app.get("/api/stats/advanced", async (req, res) => {
    try {
      // #region agent log
      debugLog('server/routes.ts:advanced-stats', 'Calculating advanced statistics', {}, 'STATS');
      // #endregion

      const allTrades = await storage.getTrades();
      debugLog('server/routes.ts:advanced-stats', 'All trades fetched for advanced stats', { count: allTrades.length, trades: allTrades.map(t => ({ id: t.id, status: t.status, profit: t.profit, exitTime: t.exitTime })) }, 'STATS');
      const calculator = new AdvancedStatsCalculator(allTrades);
      const advancedStats = calculator.calculate();

      // #region agent log
      debugLog('server/routes.ts:advanced-stats', 'Advanced statistics calculated', { 
        totalTrades: advancedStats.totalTrades,
        netProfit: advancedStats.netProfit 
      }, 'STATS');
      // #endregion

      res.json(advancedStats);
    } catch (error) {
      // #region agent log
      debugLog('server/routes.ts:advanced-stats', 'Failed to calculate advanced stats', { error: String(error) }, 'STATS');
      // #endregion
      console.error("Failed to get advanced stats:", error);
      res.status(500).json({ error: "Failed to get advanced stats" });
    }
  });

  app.get("/api/stats/advanced/:timeRange", async (req, res) => {
    try {
      const timeRange = req.params.timeRange; // week, month, quarter, year, all
      const now = new Date();
      let startDate: Date;

      switch (timeRange) {
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'quarter':
          const quarter = Math.floor(now.getMonth() / 3);
          startDate = new Date(now.getFullYear(), quarter * 3, 1);
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        default:
          startDate = new Date(0); // All time
      }

      // #region agent log
      debugLog('server/routes.ts:advanced-stats-range', 'Calculating advanced statistics for time range', { 
        timeRange, 
        startDate: startDate.toISOString() 
      }, 'STATS');
      // #endregion

      const allTrades = await storage.getTrades();
      const filteredTrades = allTrades.filter(t => {
        if (!t.exitTime) return false;
        return new Date(t.exitTime) >= startDate;
      });

      const calculator = new AdvancedStatsCalculator(filteredTrades);
      const advancedStats = calculator.calculate();

      res.json(advancedStats);
    } catch (error) {
      console.error("Failed to get advanced stats for time range:", error);
      res.status(500).json({ error: "Failed to get advanced stats" });
    }
  });

  app.get("/api/market/:symbol", async (req, res) => {
    try {
      const symbol = req.params.symbol.replace('-', '/');
      const marketData = await binanceService.getMarketPrice(symbol);
      
      if (!marketData) {
        return res.status(404).json({ error: "Market data not found" });
      }
      
      res.json(marketData);
    } catch (error) {
      console.error("Failed to get market data:", error);
      res.status(500).json({ error: "Failed to get market data" });
    }
  });

  app.get("/api/analysis/:symbol", async (req, res) => {
    try {
      const symbol = req.params.symbol.replace('-', '/');
      const settings = await storage.getSettings();
      
      const prices = await binanceService.getKlines(symbol, '1h', 200);
      
      if (prices.length === 0) {
        return res.status(404).json({ error: "No price data available" });
      }
      
      const indicators = new TechnicalIndicators({
        rsiPeriod: settings?.rsiPeriod || 14,
        rsiOverbought: settings?.rsiOverbought || 70,
        rsiOversold: settings?.rsiOversold || 30,
        maShortPeriod: settings?.maShortPeriod || 50,
        maLongPeriod: settings?.maLongPeriod || 200,
        macdFast: settings?.macdFast || 12,
        macdSlow: settings?.macdSlow || 26,
        macdSignal: settings?.macdSignal || 9,
      });
      
      const analysis = indicators.analyze(prices);
      res.json(analysis);
    } catch (error) {
      console.error("Failed to analyze market:", error);
      res.status(500).json({ error: "Failed to analyze market" });
    }
  });

  app.get("/api/analyze/:symbol", async (req, res) => {
    try {
      const symbol = req.params.symbol.replace('-', '/').replace('/', '');
      const settings = await storage.getSettings();
      
      const prices = await binanceService.getKlines(symbol, '1h', 200);
      
      if (prices.length === 0) {
        return res.status(404).json({ error: "No price data available" });
      }
      
      const indicators = new TechnicalIndicators({
        rsiPeriod: settings?.rsiPeriod || 14,
        rsiOverbought: settings?.rsiOverbought || 70,
        rsiOversold: settings?.rsiOversold || 30,
        maShortPeriod: settings?.maShortPeriod || 50,
        maLongPeriod: settings?.maLongPeriod || 200,
        macdFast: settings?.macdFast || 12,
        macdSlow: settings?.macdSlow || 26,
        macdSignal: settings?.macdSignal || 9,
      });
      
      const analysis = indicators.analyze(prices);
      
      res.json({
        symbol: symbol,
        currentPrice: prices[prices.length - 1],
        rsi: analysis.rsi,
        macd: analysis.macd,
        ma: (analysis as any).movingAverages || (analysis as any).ma || { signal: 'hold', shortMA: 0, longMA: 0 },
        overallSignal: analysis.overallSignal,
        signalStrength: analysis.signalStrength,
      });
    } catch (error) {
      console.error("Failed to analyze market:", error);
      res.status(500).json({ error: "Failed to analyze market" });
    }
  });

  app.get("/api/signals", async (req, res) => {
    try {
      const symbol = req.query.symbol as string | undefined;
      const signals = await storage.getSignals(symbol);
      res.json(signals);
    } catch (error) {
      console.error("Failed to get signals:", error);
      res.status(500).json({ error: "Failed to get signals" });
    }
  });

  app.get("/api/ai-prediction/:symbol", async (req, res) => {
    try {
      const symbol = req.params.symbol.replace('-', '/').replace('/', '');
      const timeframe = (req.query.timeframe as string) || '1h';
      
      const candles = await binanceService.getKlinesOHLCV(symbol, timeframe, 100);
      
      if (candles.length < 30) {
        return res.status(404).json({ error: "Not enough data for AI prediction" });
      }
      
      const prediction = aiPredictor.predict(candles);
      
      const marketPrice = await binanceService.getMarketPrice(symbol);
      
      res.json({
        symbol,
        timeframe,
        currentPrice: marketPrice?.price || candles[candles.length - 1].close,
        prediction,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Failed to get AI prediction:", error);
      res.status(500).json({ error: "Failed to get AI prediction" });
    }
  });

  app.get("/api/ai-predictions/all/:timeframe?", async (req, res) => {
    try {
      const settings = await storage.getSettings();
      const pairs = settings?.tradingPairs || ['BTC/USDT', 'ETH/USDT'];
      const timeframe = req.params.timeframe || (req.query.timeframe as string) || '1h';
      
      const predictions = [];
      
      for (const pair of pairs) {
        const symbol = pair.replace('/', '');
        const candles = await binanceService.getKlinesOHLCV(symbol, timeframe, 100);
        
        if (candles.length >= 30) {
          const prediction = aiPredictor.predict(candles);
          const marketPrice = await binanceService.getMarketPrice(symbol);
          
          predictions.push({
            symbol: pair,
            currentPrice: marketPrice?.price || candles[candles.length - 1].close,
            prediction,
          });
        }
      }
      
      res.json({
        timeframe,
        predictions,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Failed to get all AI predictions:", error);
      res.status(500).json({ error: "Failed to get all AI predictions" });
    }
  });

  app.post("/api/execute-trade", async (req, res) => {
    try {
      const { symbol, type } = req.body;
      
      if (!symbol || !type) {
        return res.status(400).json({ error: "Symbol and type are required" });
      }
      
      const settings = await storage.getSettings();
      if (!settings) {
        return res.status(400).json({ error: "Settings not configured" });
      }
      
      if (!settings.binanceApiKey || !settings.binanceApiSecret) {
        return res.status(400).json({ error: "Binance API not configured" });
      }
      
      binanceService.updateSettings(settings);
      
      const marketPrice = await binanceService.getMarketPrice(symbol);
      if (!marketPrice) {
        return res.status(400).json({ error: "Could not get market price" });
      }
      
      const isLong = type === 'long';
      const stopLoss = binanceService.calculateStopLoss(
        marketPrice.price,
        isLong,
        settings.maxRiskPerTrade || 2
      );
      
      const takeProfit = binanceService.calculateTakeProfit(
        marketPrice.price,
        stopLoss,
        isLong,
        settings.riskRewardRatio || 1.5
      );
      
      const accountInfo = await binanceService.getAccountInfo();
      const balance = accountInfo?.availableBalance || 1000;
      
      const positionSize = binanceService.calculatePositionSize(
        balance,
        settings.maxRiskPerTrade || 2,
        marketPrice.price,
        stopLoss,
        10
      );
      
      const order = await binanceService.placeOrder(
        symbol,
        isLong ? 'BUY' : 'SELL',
        positionSize,
        stopLoss,
        takeProfit,
        10
      );
      
      if (!order) {
        return res.status(500).json({ error: "Failed to place order" });
      }
      
      const trade = await storage.createTrade({
        symbol,
        type: isLong ? 'long' : 'short',
        status: 'active',
        entryPrice: order.price,
        quantity: order.quantity,
        leverage: 10,
        stopLoss,
        takeProfit,
        entrySignals: ['Manual'],
        binanceOrderId: order.orderId,
      });
      
      await storage.createLog({
        level: 'success',
        message: `تم تنفيذ صفقة ${isLong ? 'شراء' : 'بيع'} ${symbol}`,
        details: `سعر الدخول: $${order.price.toFixed(2)}، الكمية: ${order.quantity}`,
      });
      
      res.json({ trade, order });
    } catch (error) {
      console.error("Failed to execute trade:", error);
      res.status(500).json({ error: "Failed to execute trade" });
    }
  });

  // Auto Trading Control
  app.post("/api/auto-trading/start", async (req, res) => {
    try {
      const settings = await storage.getSettings();
      
      if (!settings) {
        return res.status(404).json({ error: "Settings not found" });
      }
      
      if (!settings.binanceApiKey || !settings.binanceApiSecret) {
        return res.status(400).json({ error: "Binance API not configured" });
      }

      await storage.updateSettings(settings.id, { autoTradingEnabled: true });
      const updatedSettings = await storage.getSettings();
      
      if (updatedSettings) {
        autoTrader.start(updatedSettings);
      }
      
      await storage.createLog({
        level: 'success',
        message: 'تم تشغيل التداول التلقائي',
      });
      
      res.json({ success: true, message: "Auto trading started" });
    } catch (error) {
      console.error("Failed to start auto trading:", error);
      res.status(500).json({ error: "Failed to start auto trading" });
    }
  });

  app.post("/api/auto-trading/stop", async (req, res) => {
    try {
      const settings = await storage.getSettings();
      
      if (settings) {
        await storage.updateSettings(settings.id, { autoTradingEnabled: false });
      }
      
      autoTrader.stop();
      
      await storage.createLog({
        level: 'warning',
        message: 'تم إيقاف التداول التلقائي',
      });
      
      res.json({ success: true, message: "Auto trading stopped" });
    } catch (error) {
      console.error("Failed to stop auto trading:", error);
      res.status(500).json({ error: "Failed to stop auto trading" });
    }
  });

  app.get("/api/auto-trading/status", async (req, res) => {
    try {
      const settings = await storage.getSettings();
      res.json({
        isRunning: autoTrader.isActive(),
        enabled: settings?.autoTradingEnabled || false,
      });
    } catch (error) {
      console.error("Failed to get auto trading status:", error);
      res.status(500).json({ error: "Failed to get status" });
    }
  });

  // Telegram Test
  app.post("/api/telegram/test", async (req, res) => {
    try {
      const settings = await storage.getSettings();
      
      if (!settings?.telegramBotToken || !settings?.telegramChatId) {
        return res.status(400).json({ error: "Telegram not configured" });
      }
      
      telegramService.updateSettings(settings);
      
      const isConnected = await telegramService.testConnection();
      
      if (!isConnected) {
        return res.status(400).json({ error: "Telegram connection failed" });
      }
      
      await telegramService.sendMessage(`
<b>اختبار الاتصال</b>

تم الاتصال بنجاح مع روبوت التداول!

<b>الوقت:</b> ${new Date().toLocaleString('ar-SA')}
      `.trim());
      
      await storage.createLog({
        level: 'success',
        message: 'تم اختبار اتصال Telegram بنجاح',
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Telegram test failed:", error);
      res.status(500).json({ error: "Telegram test failed" });
    }
  });

  // Multi-Timeframe Analysis
  app.get("/api/analyze-mtf/:symbol", async (req, res) => {
    try {
      const symbol = req.params.symbol.replace('-', '/');
      const settings = await storage.getSettings();
      const timeframes = settings?.timeframes || ['15m', '1h', '4h'];
      
      const results = [];
      
      for (const timeframe of timeframes) {
        const prices = await binanceService.getKlines(symbol, timeframe, 200);
        
        if (prices.length < 50) continue;
        
        const indicators = new TechnicalIndicators({
          rsiPeriod: settings?.rsiPeriod || 14,
          rsiOverbought: settings?.rsiOverbought || 70,
          rsiOversold: settings?.rsiOversold || 30,
          maShortPeriod: settings?.maShortPeriod || 50,
          maLongPeriod: settings?.maLongPeriod || 200,
          macdFast: settings?.macdFast || 12,
          macdSlow: settings?.macdSlow || 26,
          macdSignal: settings?.macdSignal || 9,
        });
        
        const analysis = indicators.analyze(prices);
        results.push({
          timeframe,
          ...analysis,
        });
      }
      
      const buySignals = results.filter(r => r.overallSignal === 'buy').length;
      const sellSignals = results.filter(r => r.overallSignal === 'sell').length;
      
      let overallSignal: 'buy' | 'sell' | 'hold' = 'hold';
      let confirmedTimeframes = 0;
      
      if (buySignals >= 2) {
        overallSignal = 'buy';
        confirmedTimeframes = buySignals;
      } else if (sellSignals >= 2) {
        overallSignal = 'sell';
        confirmedTimeframes = sellSignals;
      }
      
      const avgStrength = results
        .filter(r => r.overallSignal === overallSignal)
        .reduce((sum, r) => sum + r.signalStrength, 0) / Math.max(confirmedTimeframes, 1);
      
      res.json({
        symbol,
        overallSignal,
        overallStrength: Math.round(avgStrength),
        confirmedTimeframes,
        timeframeResults: results,
      });
    } catch (error) {
      console.error("Failed to analyze multi-timeframe:", error);
      res.status(500).json({ error: "Failed to analyze" });
    }
  });

  // Reports
  app.post("/api/reports/weekly", async (req, res) => {
    try {
      const settings = await storage.getSettings();
      
      if (!settings?.emailNotifications || !settings?.notificationEmail) {
        return res.status(400).json({ error: "Email notifications not configured" });
      }
      
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      const trades = await storage.getTradesInDateRange(startDate, endDate);
      
      emailService.updateSettings(settings);
      await emailService.sendReport('weekly', trades);
      
      await storage.createLog({
        level: 'info',
        message: 'تم إرسال التقرير الأسبوعي',
        details: `إلى: ${settings.notificationEmail}`,
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to send weekly report:", error);
      res.status(500).json({ error: "Failed to send report" });
    }
  });

  app.post("/api/reports/monthly", async (req, res) => {
    try {
      const settings = await storage.getSettings();
      
      if (!settings?.emailNotifications || !settings?.notificationEmail) {
        return res.status(400).json({ error: "Email notifications not configured" });
      }
      
      const endDate = new Date();
      const startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
      
      const trades = await storage.getTradesInDateRange(startDate, endDate);
      
      emailService.updateSettings(settings);
      await emailService.sendReport('monthly', trades);
      
      await storage.createLog({
        level: 'info',
        message: 'تم إرسال التقرير الشهري',
        details: `إلى: ${settings.notificationEmail}`,
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to send monthly report:", error);
      res.status(500).json({ error: "Failed to send report" });
    }
  });

  // Initialize auto trader after a delay to ensure server is fully started
  // This prevents blocking the HTTP server initialization during deployment
  setTimeout(async () => {
    try {
      let settings = await storage.getSettings();
      if (settings) {
        const { merged, changed } = mergeTradingPairs(settings.tradingPairs);
        if (changed) {
          const updated = await storage.updateSettings(settings.id, { tradingPairs: merged });
          if (updated) {
            settings = updated;
            await wsManager.broadcastSettings(updated);
            autoTrader.updateSettings(updated);
          }
        }
      }

      if (settings?.autoTradingEnabled && settings?.binanceApiKey) {
        console.log('Starting auto trader on server init (deferred)...');
        autoTrader.start(settings);
      }
    } catch (error) {
      console.error('Failed to initialize auto trader:', error);
    }
  }, 5000); // Wait 5 seconds after server starts

  // #region agent log
  debugLog('server/routes.ts:928', 'registerRoutes function completed', {}, 'B');
  // #endregion

  return httpServer;
}
