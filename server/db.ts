import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "@shared/schema";
import { sql } from "drizzle-orm";
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

const DB_PATH = (() => {
  const envPath = process.env.SQLITE_DB_PATH || process.env.DATABASE_PATH;
  const resolvedPath = envPath ? path.resolve(envPath) : path.resolve(process.cwd(), "sqlite.db");
  try {
    fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  } catch {
  }
  return resolvedPath;
})();

const sqlite = new Database(DB_PATH);
export const db = drizzle(sqlite, { schema });

// Initialize database tables if they don't exist
function initializeDatabase() {
    // #region agent log
    debugLog('server/db.ts:10', 'Database initialization started', { dbPath: DB_PATH }, 'A');
    // #endregion
    try {
        // Create users table
        sqlite.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL
      );
    `);

        // Create bot_settings table
        sqlite.exec(`
      CREATE TABLE IF NOT EXISTS bot_settings (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id),
        binance_api_key TEXT,
        binance_api_secret TEXT,
        custom_api_url TEXT,
        is_testnet INTEGER DEFAULT 1,
        is_active INTEGER DEFAULT 0,
        hedging_mode INTEGER DEFAULT 0,
        max_risk_per_trade REAL DEFAULT 2,
        risk_reward_ratio REAL DEFAULT 1.5,
        ma_short_period INTEGER DEFAULT 50,
        ma_long_period INTEGER DEFAULT 200,
        rsi_period INTEGER DEFAULT 14,
        rsi_overbought INTEGER DEFAULT 70,
        rsi_oversold INTEGER DEFAULT 30,
        macd_fast INTEGER DEFAULT 12,
        macd_slow INTEGER DEFAULT 26,
        macd_signal INTEGER DEFAULT 9,
        trading_pairs TEXT DEFAULT '[\"BTC/USDT\", \"ETH/USDT\"]',
        telegram_bot_token TEXT,
        telegram_chat_id TEXT,
        email_notifications INTEGER DEFAULT 0,
        notification_email TEXT,
        auto_trading_enabled INTEGER DEFAULT 0,
        min_signal_strength INTEGER DEFAULT 70,
        max_daily_trades INTEGER DEFAULT 10,
        trade_cooldown_minutes INTEGER DEFAULT 30,
        trailing_stop_enabled INTEGER DEFAULT 0,
        trailing_stop_percent REAL DEFAULT 1,
        trailing_stop_activation_percent REAL DEFAULT 1,
        multi_timeframe_enabled INTEGER DEFAULT 0,
        timeframes TEXT DEFAULT '[\"15m\", \"1h\", \"4h\"]',
        weekly_report_enabled INTEGER DEFAULT 0,
        monthly_report_enabled INTEGER DEFAULT 0,
        report_day INTEGER DEFAULT 0,
        ai_trading_enabled INTEGER DEFAULT 0,
        ai_min_confidence INTEGER DEFAULT 70,
        ai_min_signal_strength INTEGER DEFAULT 60,
        ai_required_signals INTEGER DEFAULT 3,
        advanced_strategies_enabled INTEGER DEFAULT 0,
        enabled_strategies TEXT DEFAULT '[\"breakout\", \"momentum\", \"meanReversion\", \"swing\"]',
        strategy_min_confidence INTEGER DEFAULT 60,
        strategy_min_strength INTEGER DEFAULT 50,
        require_strategy_consensus INTEGER DEFAULT 0,
        breakout_lookback_period INTEGER DEFAULT 20,
        breakout_threshold REAL DEFAULT 1.5,
        breakout_volume_multiplier REAL DEFAULT 1.5,
        scalping_profit_target REAL DEFAULT 0.5,
        scalping_stop_loss REAL DEFAULT 0.3,
        scalping_max_holding_period INTEGER DEFAULT 15,
        momentum_lookback_period INTEGER DEFAULT 14,
        momentum_threshold REAL DEFAULT 2,
        mean_reversion_bollinger_period INTEGER DEFAULT 20,
        mean_reversion_bollinger_std_dev REAL DEFAULT 2,
        mean_reversion_oversold_level INTEGER DEFAULT 20,
        mean_reversion_overbought_level INTEGER DEFAULT 80,
        swing_period INTEGER DEFAULT 10,
        swing_min_size REAL DEFAULT 2,
        swing_confirmation_candles INTEGER DEFAULT 3,
        grid_levels INTEGER DEFAULT 5,
        grid_spacing REAL DEFAULT 1,
        grid_order_size REAL DEFAULT 10,
        smart_position_sizing_enabled INTEGER DEFAULT 0,
        atr_period INTEGER DEFAULT 14,
        atr_multiplier REAL DEFAULT 1.5,
        max_position_percent REAL DEFAULT 10,
        min_position_percent REAL DEFAULT 1,
        volatility_adjustment INTEGER DEFAULT 1,
        market_filter_enabled INTEGER DEFAULT 0,
        avoid_high_volatility INTEGER DEFAULT 1,
        max_volatility_percent REAL DEFAULT 5,
        trend_filter_enabled INTEGER DEFAULT 1,
        min_trend_strength REAL DEFAULT 25,
        avoid_ranging_market INTEGER DEFAULT 1,
        account_protection_enabled INTEGER DEFAULT 0,
        max_daily_loss_percent REAL DEFAULT 5,
        max_concurrent_trades INTEGER DEFAULT 3,
        pause_after_consecutive_losses INTEGER DEFAULT 3,
        diversification_enabled INTEGER DEFAULT 1
      );
    `);

        // Create trades table
        sqlite.exec(`
      CREATE TABLE IF NOT EXISTS trades (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id),
        symbol TEXT NOT NULL,
        type TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        entry_price REAL NOT NULL,
        exit_price REAL,
        quantity REAL NOT NULL,
        leverage INTEGER DEFAULT 1,
        stop_loss REAL NOT NULL,
        take_profit REAL NOT NULL,
        profit REAL,
        profit_percent REAL,
        entry_time INTEGER,
        exit_time INTEGER,
        entry_signals TEXT,
        binance_order_id TEXT,
        trailing_stop_active INTEGER DEFAULT 0,
        trailing_stop_price REAL,
        highest_price REAL,
        lowest_price REAL,
        is_auto_trade INTEGER DEFAULT 0
      );
    `);

        // Create signals table
        sqlite.exec(`
      CREATE TABLE IF NOT EXISTS signals (
        id TEXT PRIMARY KEY,
        symbol TEXT NOT NULL,
        type TEXT NOT NULL,
        indicator TEXT NOT NULL,
        value REAL,
        timestamp INTEGER,
        strength REAL
      );
    `);

        // Create activity_logs table
        sqlite.exec(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id),
        level TEXT DEFAULT 'info',
        message TEXT NOT NULL,
        details TEXT,
        timestamp INTEGER
      );
    `);

        // Create market_data table
        sqlite.exec(`
      CREATE TABLE IF NOT EXISTS market_data (
        id TEXT PRIMARY KEY,
        symbol TEXT NOT NULL,
        price REAL NOT NULL,
        high_24h REAL,
        low_24h REAL,
        volume_24h REAL,
        price_change_24h REAL,
        price_change_percent_24h REAL,
        timestamp INTEGER
      );
    `);

        // #region agent log
        debugLog('server/db.ts:174', 'Database initialization completed successfully', {}, 'A');
        // #endregion
        console.log('✅ Database tables initialized successfully');
    } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        // #region agent log
        debugLog('server/db.ts:177', 'Database initialization failed', { error: String(error), stack: err.stack }, 'A');
        // #endregion
        console.error('Failed to initialize database:', error);
        throw error;
    }
}

// Run initialization
initializeDatabase();

async function insertSampleTrades() {
    debugLog('server/db.ts:216', 'Inserting sample trades', {}, 'B');
    try {
        const userId = "test-user-123"; 

        // Insert a sample user if not exists
        sqlite.exec(`
            INSERT OR IGNORE INTO users (id, username, password) VALUES
            ('${userId}', 'testuser', 'testpassword');
        `);

        // Check if trades table is empty
        const { count } = sqlite.prepare("SELECT COUNT(*) as count FROM trades").get() as { count: number };

        if (count === 0) {
            const tradesToInsert = [
                { id: "trade-1", userId, symbol: "BTC/USDT", type: "long", status: "closed", entryPrice: 30000, exitPrice: 30100, quantity: 0.01, leverage: 10, stopLoss: 29800, takeProfit: 30500, profit: 30, profitPercent: 0.1, entryTime: new Date("2026-01-10T10:00:00Z"), exitTime: new Date("2026-01-10T10:30:00Z"), isAutoTrade: true },
                { id: "trade-2", userId, symbol: "ETH/USDT", type: "short", status: "closed", entryPrice: 2000, exitPrice: 1980, quantity: 0.1, leverage: 5, stopLoss: 2020, takeProfit: 1950, profit: 20, profitPercent: 0.5, entryTime: new Date("2026-01-11T11:00:00Z"), exitTime: new Date("2026-01-11T11:45:00Z"), isAutoTrade: true },
                { id: "trade-3", userId, symbol: "BTC/USDT", type: "long", status: "closed", entryPrice: 30050, exitPrice: 29950, quantity: 0.01, leverage: 10, stopLoss: 29800, takeProfit: 30500, profit: -10, profitPercent: -0.03, entryTime: new Date("2026-01-12T12:00:00Z"), exitTime: new Date("2026-01-12T12:15:00Z"), isAutoTrade: true },
                { id: "trade-4", userId, symbol: "XRP/USDT", type: "long", status: "closed", entryPrice: 0.5, exitPrice: 0.52, quantity: 100, leverage: 2, stopLoss: 0.49, takeProfit: 0.55, profit: 2, profitPercent: 4, entryTime: new Date("2026-01-13T13:00:00Z"), exitTime: new Date("2026-01-13T13:30:00Z"), isAutoTrade: true },
                { id: "trade-5", userId, symbol: "ADA/USDT", type: "short", status: "closed", entryPrice: 0.3, exitPrice: 0.31, quantity: 200, leverage: 3, stopLoss: 0.31, takeProfit: 0.28, profit: -2, profitPercent: -3.33, entryTime: new Date("2026-01-14T14:00:00Z"), exitTime: new Date("2026-01-14T14:20:00Z"), isAutoTrade: true },
                { id: "trade-6", userId, symbol: "ETH/USDT", type: "long", status: "closed", entryPrice: 2000, exitPrice: 2050, quantity: 0.1, leverage: 5, stopLoss: 1980, takeProfit: 2100, profit: 50, profitPercent: 2.5, entryTime: new Date("2026-01-15T15:00:00Z"), exitTime: new Date("2026-01-15T15:40:00Z"), isAutoTrade: true },
            ];

            await db.insert(schema.trades).values(tradesToInsert);
            console.log('✅ Sample trades inserted successfully');
            debugLog('server/db.ts:246', 'Sample trades inserted successfully', { count: tradesToInsert.length }, 'B');
        } else {
            console.log('ℹ️ Trades table already contains data, skipping sample data insertion.');
            debugLog('server/db.ts:250', 'Trades table not empty, skipping sample data', { count }, 'B');
        }
    } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        console.error('Failed to insert sample trades:', error);
        debugLog('server/db.ts:254', 'Failed to insert sample trades', { error: String(error), stack: err.stack }, 'B');
    }
}

insertSampleTrades();
