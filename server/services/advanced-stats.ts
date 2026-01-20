import type { Trade } from "@shared/schema";
import { storage } from "../storage";

export interface AdvancedStats {
  // Basic Stats
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  
  // Profit/Loss Stats
  totalProfit: number;
  totalLoss: number;
  netProfit: number;
  grossProfit: number;
  grossLoss: number;
  
  // Average Stats
  avgProfit: number;
  avgLoss: number;
  avgTrade: number;
  
  // Best/Worst
  bestTrade: number;
  worstTrade: number;
  bestWinStreak: number;
  worstLossStreak: number;
  
  // Risk Metrics
  profitFactor: number;
  sharpeRatio: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  recoveryFactor: number;
  
  // Time-based Stats
  avgHoldingTime: number; // in hours
  longestTrade: number; // in hours
  shortestTrade: number; // in hours
  
  // Risk/Reward
  avgRiskReward: number;
  largestWin: number;
  largestLoss: number;
  
  // Performance Metrics
  expectancy: number;
  kellyPercentage: number;
  returnOnInvestment: number;
  
  // Time Period Stats
  monthlyReturns: Array<{ month: string; profit: number; trades: number }>;
  weeklyReturns: Array<{ week: string; profit: number; trades: number }>;
  dailyReturns: Array<{ date: string; profit: number; trades: number }>;
  
  // Strategy Performance
  strategyPerformance: Record<string, {
    trades: number;
    profit: number;
    winRate: number;
    avgProfit: number;
  }>;
  
  // Pair Performance
  pairPerformance: Array<{
    symbol: string;
    trades: number;
    profit: number;
    winRate: number;
    avgProfit: number;
  }>;
}

export class AdvancedStatsCalculator {
  private trades: Trade[];

  constructor(trades: Trade[]) {
    this.trades = trades.filter(t => t.status === 'closed' && t.exitTime);
  }

  calculate(): AdvancedStats {
    if (this.trades.length === 0) {
      return this.getEmptyStats();
    }

    const closedTrades = this.trades;
    const profits = closedTrades.map(t => t.profit || 0);
    const winningTrades = closedTrades.filter(t => (t.profit || 0) > 0);
    const losingTrades = closedTrades.filter(t => (t.profit || 0) < 0);

    // Basic Stats
    const totalTrades = closedTrades.length;
    const winningTradesCount = winningTrades.length;
    const losingTradesCount = losingTrades.length;
    const winRate = totalTrades > 0 ? (winningTradesCount / totalTrades) * 100 : 0;

    // Profit/Loss Stats
    const totalProfit = profits.reduce((sum, p) => sum + (p > 0 ? p : 0), 0);
    const totalLoss = Math.abs(profits.reduce((sum, p) => sum + (p < 0 ? p : 0), 0));
    const netProfit = profits.reduce((sum, p) => sum + p, 0);
    const grossProfit = totalProfit;
    const grossLoss = totalLoss;

    // Average Stats
    const avgProfit = winningTradesCount > 0 ? totalProfit / winningTradesCount : 0;
    const avgLoss = losingTradesCount > 0 ? totalLoss / losingTradesCount : 0;
    const avgTrade = totalTrades > 0 ? netProfit / totalTrades : 0;

    // Best/Worst
    const bestTrade = Math.max(...profits, 0);
    const worstTrade = Math.min(...profits, 0);
    const { bestStreak, worstStreak } = this.calculateStreaks(profits);

    // Risk Metrics
    const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? Infinity : 0;
    const sharpeRatio = this.calculateSharpeRatio(profits);
    const { maxDrawdown, maxDrawdownPercent } = this.calculateMaxDrawdown(profits);
    const recoveryFactor = maxDrawdown !== 0 ? netProfit / Math.abs(maxDrawdown) : netProfit > 0 ? Infinity : 0;

    // Time-based Stats
    const { avgHoldingTime, longestTrade, shortestTrade } = this.calculateHoldingTimes(closedTrades);

    // Risk/Reward
    const avgRiskReward = this.calculateAvgRiskReward(closedTrades);
    const largestWin = bestTrade;
    const largestLoss = worstTrade;

    // Performance Metrics
    const expectancy = this.calculateExpectancy(profits, winRate / 100);
    const kellyPercentage = this.calculateKellyPercentage(winRate / 100, avgProfit, avgLoss);
    const returnOnInvestment = this.calculateROI(netProfit);

    // Time Period Stats
    const monthlyReturns = this.calculateMonthlyReturns(closedTrades);
    const weeklyReturns = this.calculateWeeklyReturns(closedTrades);
    const dailyReturns = this.calculateDailyReturns(closedTrades);

    // Strategy Performance
    const strategyPerformance = this.calculateStrategyPerformance(closedTrades);

    // Pair Performance
    const pairPerformance = this.calculatePairPerformance(closedTrades);

    return {
      totalTrades,
      winningTrades: winningTradesCount,
      losingTrades: losingTradesCount,
      winRate,
      totalProfit,
      totalLoss,
      netProfit,
      grossProfit,
      grossLoss,
      avgProfit,
      avgLoss,
      avgTrade,
      bestTrade,
      worstTrade,
      bestWinStreak: bestStreak,
      worstLossStreak: worstStreak,
      profitFactor,
      sharpeRatio,
      maxDrawdown,
      maxDrawdownPercent,
      recoveryFactor,
      avgHoldingTime,
      longestTrade,
      shortestTrade,
      avgRiskReward,
      largestWin,
      largestLoss,
      expectancy,
      kellyPercentage,
      returnOnInvestment,
      monthlyReturns,
      weeklyReturns,
      dailyReturns,
      strategyPerformance,
      pairPerformance,
    };
  }

  private getEmptyStats(): AdvancedStats {
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      totalProfit: 0,
      totalLoss: 0,
      netProfit: 0,
      grossProfit: 0,
      grossLoss: 0,
      avgProfit: 0,
      avgLoss: 0,
      avgTrade: 0,
      bestTrade: 0,
      worstTrade: 0,
      bestWinStreak: 0,
      worstLossStreak: 0,
      profitFactor: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      maxDrawdownPercent: 0,
      recoveryFactor: 0,
      avgHoldingTime: 0,
      longestTrade: 0,
      shortestTrade: 0,
      avgRiskReward: 0,
      largestWin: 0,
      largestLoss: 0,
      expectancy: 0,
      kellyPercentage: 0,
      returnOnInvestment: 0,
      monthlyReturns: [],
      weeklyReturns: [],
      dailyReturns: [],
      strategyPerformance: {},
      pairPerformance: [],
    };
  }

  private calculateStreaks(profits: number[]): { bestStreak: number; worstStreak: number } {
    let bestStreak = 0;
    let worstStreak = 0;
    let currentWinStreak = 0;
    let currentLossStreak = 0;

    for (const profit of profits) {
      if (profit > 0) {
        currentWinStreak++;
        currentLossStreak = 0;
        bestStreak = Math.max(bestStreak, currentWinStreak);
      } else if (profit < 0) {
        currentLossStreak++;
        currentWinStreak = 0;
        worstStreak = Math.max(worstStreak, currentLossStreak);
      } else {
        currentWinStreak = 0;
        currentLossStreak = 0;
      }
    }

    return { bestStreak, worstStreak };
  }

  private calculateSharpeRatio(returns: number[]): number {
    if (returns.length < 2) return 0;

    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return 0;

    // Assuming risk-free rate of 0 for simplicity
    return avgReturn / stdDev;
  }

  private calculateMaxDrawdown(profits: number[]): { maxDrawdown: number; maxDrawdownPercent: number } {
    let maxDrawdown = 0;
    let maxDrawdownPercent = 0;
    let peak = 0;
    let cumulative = 0;

    for (const profit of profits) {
      cumulative += profit;
      if (cumulative > peak) {
        peak = cumulative;
      }
      const drawdown = peak - cumulative;
      const drawdownPercent = peak > 0 ? (drawdown / peak) * 100 : 0;

      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
        maxDrawdownPercent = drawdownPercent;
      }
    }

    return { maxDrawdown, maxDrawdownPercent };
  }

  private calculateHoldingTimes(trades: Trade[]): {
    avgHoldingTime: number;
    longestTrade: number;
    shortestTrade: number;
  } {
    const holdingTimes: number[] = [];

    for (const trade of trades) {
      if (trade.entryTime && trade.exitTime) {
        const entry = new Date(trade.entryTime).getTime();
        const exit = new Date(trade.exitTime).getTime();
        const hours = (exit - entry) / (1000 * 60 * 60);
        holdingTimes.push(hours);
      }
    }

    if (holdingTimes.length === 0) {
      return { avgHoldingTime: 0, longestTrade: 0, shortestTrade: 0 };
    }

    const avgHoldingTime = holdingTimes.reduce((sum, t) => sum + t, 0) / holdingTimes.length;
    const longestTrade = Math.max(...holdingTimes);
    const shortestTrade = Math.min(...holdingTimes);

    return { avgHoldingTime, longestTrade, shortestTrade };
  }

  private calculateAvgRiskReward(trades: Trade[]): number {
    const riskRewards: number[] = [];

    for (const trade of trades) {
      if (trade.stopLoss && trade.takeProfit && trade.entryPrice) {
        const risk = Math.abs(trade.entryPrice - trade.stopLoss);
        const reward = Math.abs(trade.takeProfit - trade.entryPrice);
        if (risk > 0) {
          riskRewards.push(reward / risk);
        }
      }
    }

    return riskRewards.length > 0
      ? riskRewards.reduce((sum, rr) => sum + rr, 0) / riskRewards.length
      : 0;
  }

  private calculateExpectancy(profits: number[], winRate: number): number {
    if (profits.length === 0) return 0;

    const avgWin = profits.filter(p => p > 0).reduce((sum, p) => sum + p, 0) / profits.filter(p => p > 0).length || 0;
    const avgLoss = Math.abs(profits.filter(p => p < 0).reduce((sum, p) => sum + p, 0) / profits.filter(p => p < 0).length || 0);

    return (winRate * avgWin) - ((1 - winRate) * avgLoss);
  }

  private calculateKellyPercentage(winRate: number, avgWin: number, avgLoss: number): number {
    if (avgLoss === 0 || avgWin === 0) return 0;

    const winLossRatio = avgWin / avgLoss;
    const kelly = (winRate * winLossRatio - (1 - winRate)) / winLossRatio;

    // Cap at 25% for safety
    return Math.max(0, Math.min(kelly * 100, 25));
  }

  private calculateROI(netProfit: number): number {
    // Assuming initial balance of 10000
    const initialBalance = 10000;
    return initialBalance > 0 ? (netProfit / initialBalance) * 100 : 0;
  }

  private calculateMonthlyReturns(trades: Trade[]): Array<{ month: string; profit: number; trades: number }> {
    const monthlyData: Record<string, { profit: number; trades: number }> = {};
    const months = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
                    "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

    for (const trade of trades) {
      if (trade.exitTime) {
        const date = new Date(trade.exitTime);
        const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
        const monthName = `${months[date.getMonth()]} ${date.getFullYear()}`;

        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = { profit: 0, trades: 0 };
        }

        monthlyData[monthKey].profit += trade.profit || 0;
        monthlyData[monthKey].trades++;
      }
    }

    return Object.entries(monthlyData)
      .map(([key, data]) => ({
        month: key.split('-')[1] ? months[parseInt(key.split('-')[1])] + ' ' + key.split('-')[0] : key,
        profit: data.profit,
        trades: data.trades,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }

  private calculateWeeklyReturns(trades: Trade[]): Array<{ week: string; profit: number; trades: number }> {
    const weeklyData: Record<string, { profit: number; trades: number }> = {};

    for (const trade of trades) {
      if (trade.exitTime) {
        const date = new Date(trade.exitTime);
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        weekStart.setHours(0, 0, 0, 0);
        
        const weekKey = weekStart.toISOString().split('T')[0];
        const weekLabel = `أسبوع ${weekStart.toLocaleDateString('ar-SA')}`;

        if (!weeklyData[weekKey]) {
          weeklyData[weekKey] = { profit: 0, trades: 0 };
        }

        weeklyData[weekKey].profit += trade.profit || 0;
        weeklyData[weekKey].trades++;
      }
    }

    return Object.entries(weeklyData)
      .map(([key, data]) => ({
        week: key,
        profit: data.profit,
        trades: data.trades,
      }))
      .sort((a, b) => a.week.localeCompare(b.week))
      .slice(-12); // Last 12 weeks
  }

  private calculateDailyReturns(trades: Trade[]): Array<{ date: string; profit: number; trades: number }> {
    const dailyData: Record<string, { profit: number; trades: number }> = {};

    for (const trade of trades) {
      if (trade.exitTime) {
        const date = new Date(trade.exitTime).toISOString().split('T')[0];

        if (!dailyData[date]) {
          dailyData[date] = { profit: 0, trades: 0 };
        }

        dailyData[date].profit += trade.profit || 0;
        dailyData[date].trades++;
      }
    }

    return Object.entries(dailyData)
      .map(([date, data]) => ({
        date,
        profit: data.profit,
        trades: data.trades,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30); // Last 30 days
  }

  private calculateStrategyPerformance(trades: Trade[]): Record<string, {
    trades: number;
    profit: number;
    winRate: number;
    avgProfit: number;
  }> {
    const strategyData: Record<string, { profits: number[]; trades: number }> = {};

    for (const trade of trades) {
      const strategies = (trade.entrySignals as string[]) || ['Unknown'];
      
      for (const strategy of strategies) {
        if (!strategyData[strategy]) {
          strategyData[strategy] = { profits: [], trades: 0 };
        }
        strategyData[strategy].profits.push(trade.profit || 0);
        strategyData[strategy].trades++;
      }
    }

    const result: Record<string, { trades: number; profit: number; winRate: number; avgProfit: number }> = {};

    for (const [strategy, data] of Object.entries(strategyData)) {
      const winningTrades = data.profits.filter(p => p > 0).length;
      const winRate = data.trades > 0 ? (winningTrades / data.trades) * 100 : 0;
      const profit = data.profits.reduce((sum, p) => sum + p, 0);
      const avgProfit = data.trades > 0 ? profit / data.trades : 0;

      result[strategy] = {
        trades: data.trades,
        profit,
        winRate,
        avgProfit,
      };
    }

    return result;
  }

  private calculatePairPerformance(trades: Trade[]): Array<{
    symbol: string;
    trades: number;
    profit: number;
    winRate: number;
    avgProfit: number;
  }> {
    const pairData: Record<string, { profits: number[]; trades: number }> = {};

    for (const trade of trades) {
      if (!pairData[trade.symbol]) {
        pairData[trade.symbol] = { profits: [], trades: 0 };
      }
      pairData[trade.symbol].profits.push(trade.profit || 0);
      pairData[trade.symbol].trades++;
    }

    return Object.entries(pairData)
      .map(([symbol, data]) => {
        const winningTrades = data.profits.filter(p => p > 0).length;
        const winRate = data.trades > 0 ? (winningTrades / data.trades) * 100 : 0;
        const profit = data.profits.reduce((sum, p) => sum + p, 0);
        const avgProfit = data.trades > 0 ? profit / data.trades : 0;

        return {
          symbol,
          trades: data.trades,
          profit,
          winRate,
          avgProfit,
        };
      })
      .sort((a, b) => b.profit - a.profit);
  }
}
