import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Enums - handled as arrays of strings for validation
export const tradeTypes = ['long', 'short'] as const;
export const tradeStatuses = ['active', 'closed', 'pending', 'cancelled'] as const;
export const signalTypes = ['buy', 'sell', 'hold'] as const;
export const logLevels = ['info', 'warning', 'error', 'success'] as const;

export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const botSettings = sqliteTable("bot_settings", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").references(() => users.id),
  binanceApiKey: text("binance_api_key"),
  binanceApiSecret: text("binance_api_secret"),
  customApiUrl: text("custom_api_url"),
  isTestnet: integer("is_testnet", { mode: 'boolean' }).default(true),
  isActive: integer("is_active", { mode: 'boolean' }).default(false),
  hedgingMode: integer("hedging_mode", { mode: 'boolean' }).default(false),
  maxRiskPerTrade: real("max_risk_per_trade").default(2),
  riskRewardRatio: real("risk_reward_ratio").default(1.5),
  maShortPeriod: integer("ma_short_period").default(50),
  maLongPeriod: integer("ma_long_period").default(200),
  rsiPeriod: integer("rsi_period").default(14),
  rsiOverbought: integer("rsi_overbought").default(70),
  rsiOversold: integer("rsi_oversold").default(30),
  macdFast: integer("macd_fast").default(12),
  macdSlow: integer("macd_slow").default(26),
  macdSignal: integer("macd_signal").default(9),
  tradingPairs: text("trading_pairs", { mode: 'json' }).$type<string[]>().default(sql`'["BTC/USDT", "ETH/USDT", "BNB/USDT", "SOL/USDT", "XRP/USDT", "ADA/USDT", "DOGE/USDT", "LINK/USDT", "AVAX/USDT", "LTC/USDT", "DOT/USDT"]'`),
  telegramBotToken: text("telegram_bot_token"),
  telegramChatId: text("telegram_chat_id"),
  emailNotifications: integer("email_notifications", { mode: 'boolean' }).default(false),
  notificationEmail: text("notification_email"),
  // Auto Trading Settings
  autoTradingEnabled: integer("auto_trading_enabled", { mode: 'boolean' }).default(false),
  minSignalStrength: integer("min_signal_strength").default(70),
  maxDailyTrades: integer("max_daily_trades").default(10),
  tradeCooldownMinutes: integer("trade_cooldown_minutes").default(30),
  // Trailing Stop-Loss Settings
  trailingStopEnabled: integer("trailing_stop_enabled", { mode: 'boolean' }).default(false),
  trailingStopPercent: real("trailing_stop_percent").default(1),
  trailingStopActivationPercent: real("trailing_stop_activation_percent").default(1),
  // Multi-Timeframe Analysis Settings
  multiTimeframeEnabled: integer("multi_timeframe_enabled", { mode: 'boolean' }).default(false),
  timeframes: text("timeframes", { mode: 'json' }).$type<string[]>().default(sql`'["15m", "1h", "4h"]'`),
  // Report Settings
  weeklyReportEnabled: integer("weekly_report_enabled", { mode: 'boolean' }).default(false),
  monthlyReportEnabled: integer("monthly_report_enabled", { mode: 'boolean' }).default(false),
  reportDay: integer("report_day").default(0),
  // AI Trading Settings
  aiTradingEnabled: integer("ai_trading_enabled", { mode: 'boolean' }).default(false),
  aiMinConfidence: integer("ai_min_confidence").default(70),
  aiMinSignalStrength: integer("ai_min_signal_strength").default(60),
  aiRequiredSignals: integer("ai_required_signals").default(3),
  // Advanced Strategies Settings
  advancedStrategiesEnabled: integer("advanced_strategies_enabled", { mode: 'boolean' }).default(false),
  enabledStrategies: text("enabled_strategies", { mode: 'json' }).$type<string[]>().default(sql`'["breakout", "momentum", "meanReversion", "swing"]'`),
  strategyMinConfidence: integer("strategy_min_confidence").default(60),
  strategyMinStrength: integer("strategy_min_strength").default(50),
  requireStrategyConsensus: integer("require_strategy_consensus", { mode: 'boolean' }).default(false),
  // Breakout Strategy Settings
  breakoutLookbackPeriod: integer("breakout_lookback_period").default(20),
  breakoutThreshold: real("breakout_threshold").default(1.5),
  breakoutVolumeMultiplier: real("breakout_volume_multiplier").default(1.5),
  // Scalping Strategy Settings
  scalpingProfitTarget: real("scalping_profit_target").default(0.5),
  scalpingStopLoss: real("scalping_stop_loss").default(0.3),
  scalpingMaxHoldingPeriod: integer("scalping_max_holding_period").default(15),
  // Momentum Strategy Settings
  momentumLookbackPeriod: integer("momentum_lookback_period").default(14),
  momentumThreshold: real("momentum_threshold").default(2),
  // Mean Reversion Strategy Settings
  meanReversionBollingerPeriod: integer("mean_reversion_bollinger_period").default(20),
  meanReversionBollingerStdDev: real("mean_reversion_bollinger_std_dev").default(2),
  meanReversionOversoldLevel: integer("mean_reversion_oversold_level").default(20),
  meanReversionOverboughtLevel: integer("mean_reversion_overbought_level").default(80),
  // Swing Strategy Settings
  swingPeriod: integer("swing_period").default(10),
  swingMinSize: real("swing_min_size").default(2),
  swingConfirmationCandles: integer("swing_confirmation_candles").default(3),
  // Grid Trading Settings
  gridLevels: integer("grid_levels").default(5),
  gridSpacing: real("grid_spacing").default(1),
  gridOrderSize: real("grid_order_size").default(10),
  // Smart Position Sizing Settings
  smartPositionSizingEnabled: integer("smart_position_sizing_enabled", { mode: 'boolean' }).default(false),
  atrPeriod: integer("atr_period").default(14),
  atrMultiplier: real("atr_multiplier").default(1.5),
  maxPositionPercent: real("max_position_percent").default(10),
  minPositionPercent: real("min_position_percent").default(1),
  volatilityAdjustment: integer("volatility_adjustment", { mode: 'boolean' }).default(true),
  // Market Filter Settings
  marketFilterEnabled: integer("market_filter_enabled", { mode: 'boolean' }).default(false),
  avoidHighVolatility: integer("avoid_high_volatility", { mode: 'boolean' }).default(true),
  maxVolatilityPercent: real("max_volatility_percent").default(5),
  trendFilterEnabled: integer("trend_filter_enabled", { mode: 'boolean' }).default(true),
  minTrendStrength: real("min_trend_strength").default(25),
  avoidRangingMarket: integer("avoid_ranging_market", { mode: 'boolean' }).default(true),
  // Account Protection Settings
  accountProtectionEnabled: integer("account_protection_enabled", { mode: 'boolean' }).default(false),
  maxDailyLossPercent: real("max_daily_loss_percent").default(5),
  maxConcurrentTrades: integer("max_concurrent_trades").default(3),
  pauseAfterConsecutiveLosses: integer("pause_after_consecutive_losses").default(3),
  diversificationEnabled: integer("diversification_enabled", { mode: 'boolean' }).default(true),
});

export const trades = sqliteTable("trades", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").references(() => users.id),
  symbol: text("symbol").notNull(),
  type: text("type").notNull(), // Enum 'long' | 'short'
  status: text("status").default('active'), // Enum
  entryPrice: real("entry_price").notNull(),
  exitPrice: real("exit_price"),
  quantity: real("quantity").notNull(),
  leverage: integer("leverage").default(1),
  stopLoss: real("stop_loss").notNull(),
  takeProfit: real("take_profit").notNull(),
  profit: real("profit"),
  profitPercent: real("profit_percent"),
  entryTime: integer("entry_time", { mode: 'timestamp' }).$defaultFn(() => new Date()),
  exitTime: integer("exit_time", { mode: 'timestamp' }),
  entrySignals: text("entry_signals", { mode: 'json' }).$type<string[]>(),
  binanceOrderId: text("binance_order_id"),
  // Trailing Stop-Loss
  trailingStopActive: integer("trailing_stop_active", { mode: 'boolean' }).default(false),
  trailingStopPrice: real("trailing_stop_price"),
  highestPrice: real("highest_price"),
  lowestPrice: real("lowest_price"),
  // Auto-trade flag
  isAutoTrade: integer("is_auto_trade", { mode: 'boolean' }).default(false),
});

export const signals = sqliteTable("signals", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  symbol: text("symbol").notNull(),
  type: text("type").notNull(), // Enum
  indicator: text("indicator").notNull(),
  value: real("value"),
  timestamp: integer("timestamp", { mode: 'timestamp' }).$defaultFn(() => new Date()),
  strength: real("strength"),
});

export const activityLogs = sqliteTable("activity_logs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").references(() => users.id),
  level: text("level").default('info'), // Enum
  message: text("message").notNull(),
  details: text("details"),
  timestamp: integer("timestamp", { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const marketData = sqliteTable("market_data", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  symbol: text("symbol").notNull(),
  price: real("price").notNull(),
  high24h: real("high_24h"),
  low24h: real("low_24h"),
  volume24h: real("volume_24h"),
  priceChange24h: real("price_change_24h"),
  priceChangePercent24h: real("price_change_percent_24h"),
  timestamp: integer("timestamp", { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const usersRelations = relations(users, ({ many, one }) => ({
  trades: many(trades),
  logs: many(activityLogs),
  settings: one(botSettings),
}));

export const tradesRelations = relations(trades, ({ one }) => ({
  user: one(users, {
    fields: [trades.userId],
    references: [users.id],
  }),
}));

export const botSettingsRelations = relations(botSettings, ({ one }) => ({
  user: one(users, {
    fields: [botSettings.userId],
    references: [users.id],
  }),
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  user: one(users, {
    fields: [activityLogs.userId],
    references: [users.id],
  }),
}));

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertBotSettingsSchema = createInsertSchema(botSettings).omit({
  id: true,
}).extend({
  tradingPairs: z
    .array(z.string())
    .default(["BTC/USDT", "ETH/USDT", "BNB/USDT", "SOL/USDT", "XRP/USDT", "ADA/USDT", "DOGE/USDT", "LINK/USDT", "AVAX/USDT", "LTC/USDT", "DOT/USDT"]),
  timeframes: z.array(z.string()).default(["15m", "1h", "4h"]),
  enabledStrategies: z
    .array(z.string())
    .default(["breakout", "momentum", "meanReversion", "swing"]),
});

export const insertTradeSchema = createInsertSchema(trades).omit({
  id: true,
  entryTime: true,
  exitTime: true,
}).extend({
  entrySignals: z.array(z.string()).optional(),
});

export const insertSignalSchema = createInsertSchema(signals).omit({
  id: true,
  timestamp: true,
});

export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({
  id: true,
  timestamp: true,
});

export const insertMarketDataSchema = createInsertSchema(marketData).omit({
  id: true,
  timestamp: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertBotSettings = z.infer<typeof insertBotSettingsSchema>;
export type BotSettings = typeof botSettings.$inferSelect;

export type InsertTrade = z.infer<typeof insertTradeSchema>;
export type Trade = typeof trades.$inferSelect;

export type InsertSignal = z.infer<typeof insertSignalSchema>;
export type Signal = typeof signals.$inferSelect;

export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type ActivityLog = typeof activityLogs.$inferSelect;

export type InsertMarketData = z.infer<typeof insertMarketDataSchema>;
export type MarketData = typeof marketData.$inferSelect;

export type TradeType = 'long' | 'short';
export type TradeStatus = 'active' | 'closed' | 'pending' | 'cancelled';
export type SignalType = 'buy' | 'sell' | 'hold';
export type LogLevel = 'info' | 'warning' | 'error' | 'success';
