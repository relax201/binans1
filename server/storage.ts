import { 
  users, 
  botSettings, 
  trades, 
  signals, 
  activityLogs,
  marketData,
  type User, 
  type InsertUser,
  type BotSettings,
  type InsertBotSettings,
  type Trade,
  type InsertTrade,
  type Signal,
  type InsertSignal,
  type ActivityLog,
  type InsertActivityLog,
  type MarketData,
  type InsertMarketData,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sql, gte, lte } from "drizzle-orm";

export interface TrailingStopUpdate {
  stopLoss: number;
  highestPrice?: number;
  lowestPrice?: number;
  trailingStopPrice?: number;
}

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getSettings(userId?: string): Promise<BotSettings | undefined>;
  createSettings(settings: InsertBotSettings): Promise<BotSettings>;
  updateSettings(id: string, settings: Partial<InsertBotSettings>): Promise<BotSettings | undefined>;
  
  getTrades(status?: string): Promise<Trade[]>;
  getTradeById(id: string): Promise<Trade | undefined>;
  createTrade(trade: InsertTrade): Promise<Trade>;
  updateTrade(id: string, trade: Partial<InsertTrade>): Promise<Trade | undefined>;
  closeTrade(id: string, exitPrice: number, profit: number, profitPercent: number): Promise<Trade | undefined>;
  closeAllTrades(): Promise<void>;
  getTradeHistory(limit?: number): Promise<Trade[]>;
  updateTradeTrailingStop(id: string, update: TrailingStopUpdate): Promise<Trade | undefined>;
  getTradesInDateRange(startDate: Date, endDate: Date): Promise<Trade[]>;
  
  getSignals(symbol?: string): Promise<Signal[]>;
  createSignal(signal: InsertSignal): Promise<Signal>;
  
  getLogs(limit?: number): Promise<ActivityLog[]>;
  createLog(log: InsertActivityLog): Promise<ActivityLog>;
  
  getMarketData(symbol: string): Promise<MarketData | undefined>;
  updateMarketData(data: InsertMarketData): Promise<MarketData>;
  
  getStats(): Promise<{
    totalBalance: number;
    todayProfit: number;
    todayProfitPercent: number;
    activeTrades: number;
    successRate: number;
    totalTrades: number;
    winRate: number;
    avgProfit: number;
    avgLoss: number;
    bestTrade: number;
    worstTrade: number;
    totalVolume: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getSettings(userId?: string): Promise<BotSettings | undefined> {
    if (userId) {
      const [settings] = await db.select().from(botSettings).where(eq(botSettings.userId, userId));
      return settings || undefined;
    }
    const [settings] = await db.select().from(botSettings).limit(1);
    return settings || undefined;
  }

  async createSettings(settings: InsertBotSettings): Promise<BotSettings> {
    const [result] = await db.insert(botSettings).values(settings).returning();
    return result;
  }

  async updateSettings(id: string, settings: Partial<InsertBotSettings>): Promise<BotSettings | undefined> {
    const [result] = await db
      .update(botSettings)
      .set(settings)
      .where(eq(botSettings.id, id))
      .returning();
    return result || undefined;
  }

  async getTrades(status?: string): Promise<Trade[]> {
    if (status) {
      const result = await db
        .select()
        .from(trades)
        .where(eq(trades.status, status as any))
        .orderBy(desc(trades.entryTime));
      return result;
    }
    return db.select().from(trades).orderBy(desc(trades.entryTime));
  }

  async getTradeById(id: string): Promise<Trade | undefined> {
    const [trade] = await db.select().from(trades).where(eq(trades.id, id));
    return trade || undefined;
  }

  async createTrade(trade: InsertTrade): Promise<Trade> {
    const [result] = await db.insert(trades).values(trade).returning();
    return result;
  }

  async updateTrade(id: string, trade: Partial<InsertTrade>): Promise<Trade | undefined> {
    const [result] = await db
      .update(trades)
      .set(trade)
      .where(eq(trades.id, id))
      .returning();
    return result || undefined;
  }

  async closeTrade(id: string, exitPrice: number, profit: number, profitPercent: number): Promise<Trade | undefined> {
    const [result] = await db
      .update(trades)
      .set({
        status: 'closed',
        exitPrice,
        profit,
        profitPercent,
        exitTime: new Date(),
      })
      .where(eq(trades.id, id))
      .returning();
    return result || undefined;
  }

  async closeAllTrades(): Promise<void> {
    await db
      .update(trades)
      .set({
        status: 'closed',
        exitTime: new Date(),
      })
      .where(eq(trades.status, 'active'));
  }

  async getTradeHistory(limit = 50): Promise<Trade[]> {
    return db
      .select()
      .from(trades)
      .where(eq(trades.status, 'closed'))
      .orderBy(desc(trades.exitTime))
      .limit(limit);
  }

  async updateTradeTrailingStop(id: string, update: TrailingStopUpdate): Promise<Trade | undefined> {
    const [result] = await db
      .update(trades)
      .set({
        stopLoss: update.stopLoss,
        highestPrice: update.highestPrice,
        lowestPrice: update.lowestPrice,
        trailingStopPrice: update.trailingStopPrice,
      })
      .where(eq(trades.id, id))
      .returning();
    return result || undefined;
  }

  async getTradesInDateRange(startDate: Date, endDate: Date): Promise<Trade[]> {
    return db
      .select()
      .from(trades)
      .where(
        and(
          gte(trades.entryTime, startDate),
          lte(trades.entryTime, endDate)
        )
      )
      .orderBy(desc(trades.entryTime));
  }

  async getSignals(symbol?: string): Promise<Signal[]> {
    if (symbol) {
      return db
        .select()
        .from(signals)
        .where(eq(signals.symbol, symbol))
        .orderBy(desc(signals.timestamp));
    }
    return db.select().from(signals).orderBy(desc(signals.timestamp));
  }

  async createSignal(signal: InsertSignal): Promise<Signal> {
    const [result] = await db.insert(signals).values(signal).returning();
    return result;
  }

  async getLogs(limit = 50): Promise<ActivityLog[]> {
    return db
      .select()
      .from(activityLogs)
      .orderBy(desc(activityLogs.timestamp))
      .limit(limit);
  }

  async createLog(log: InsertActivityLog): Promise<ActivityLog> {
    const [result] = await db.insert(activityLogs).values(log).returning();
    return result;
  }

  async getMarketData(symbol: string): Promise<MarketData | undefined> {
    const [data] = await db
      .select()
      .from(marketData)
      .where(eq(marketData.symbol, symbol))
      .orderBy(desc(marketData.timestamp))
      .limit(1);
    return data || undefined;
  }

  async updateMarketData(data: InsertMarketData): Promise<MarketData> {
    const existing = await this.getMarketData(data.symbol);
    if (existing) {
      const [result] = await db
        .update(marketData)
        .set({ ...data, timestamp: new Date() })
        .where(eq(marketData.id, existing.id))
        .returning();
      return result;
    }
    const [result] = await db.insert(marketData).values(data).returning();
    return result;
  }

  async getStats(): Promise<{
    totalBalance: number;
    todayProfit: number;
    todayProfitPercent: number;
    activeTrades: number;
    successRate: number;
    totalTrades: number;
    winRate: number;
    avgProfit: number;
    avgLoss: number;
    bestTrade: number;
    worstTrade: number;
    totalVolume: number;
  }> {
    const allTrades = await db.select().from(trades);
    const activeTrades = allTrades.filter(t => t.status === 'active');
    const closedTrades = allTrades.filter(t => t.status === 'closed');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTrades = closedTrades.filter(t => 
      t.exitTime && new Date(t.exitTime) >= today
    );
    
    const totalProfit = closedTrades.reduce((sum, t) => sum + (t.profit || 0), 0);
    const todayProfit = todayTrades.reduce((sum, t) => sum + (t.profit || 0), 0);
    
    const winningTrades = closedTrades.filter(t => (t.profit || 0) > 0);
    const losingTrades = closedTrades.filter(t => (t.profit || 0) < 0);
    
    const avgProfit = winningTrades.length > 0
      ? winningTrades.reduce((sum, t) => sum + (t.profit || 0), 0) / winningTrades.length
      : 0;
    
    const avgLoss = losingTrades.length > 0
      ? losingTrades.reduce((sum, t) => sum + (t.profit || 0), 0) / losingTrades.length
      : 0;
    
    const profits = closedTrades.map(t => t.profit || 0);
    const bestTrade = profits.length > 0 ? Math.max(...profits) : 0;
    const worstTrade = profits.length > 0 ? Math.min(...profits) : 0;
    
    const totalVolume = allTrades.reduce((sum, t) => 
      sum + (t.entryPrice * t.quantity), 0
    );
    
    const settings = await this.getSettings();
    const initialBalance = 10000;
    
    return {
      totalBalance: initialBalance + totalProfit,
      todayProfit,
      todayProfitPercent: initialBalance > 0 ? (todayProfit / initialBalance) * 100 : 0,
      activeTrades: activeTrades.length,
      successRate: closedTrades.length > 0 
        ? (winningTrades.length / closedTrades.length) * 100 
        : 0,
      totalTrades: closedTrades.length,
      winRate: closedTrades.length > 0 
        ? (winningTrades.length / closedTrades.length) * 100 
        : 0,
      avgProfit,
      avgLoss,
      bestTrade,
      worstTrade,
      totalVolume,
    };
  }
}

export const storage = new DatabaseStorage();
