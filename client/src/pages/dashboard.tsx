import { useQuery } from "@tanstack/react-query";
import { StatsCard } from "@/components/stats-card";
import { TradeCard } from "@/components/trade-card";
import { TechnicalIndicators } from "@/components/signal-indicator";
import { ActivityLogList } from "@/components/activity-log";
import { MarketTickerBar } from "@/components/market-ticker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Wallet,
  TrendingUp,
  Activity,
  Percent,
  Play,
  Pause,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { Trade, ActivityLog, BotSettings } from "@shared/schema";
import { useState, useMemo } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface MarketTicker {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
}

export default function Dashboard() {
  const { toast } = useToast();
  const [isToggling, setIsToggling] = useState(false);

  const { data: settings, isLoading: settingsLoading } = useQuery<BotSettings>({
    queryKey: ["/api/settings"],
  });

  const { data: activeTrades = [], isLoading: tradesLoading } = useQuery<Trade[]>({
    queryKey: ["/api/trades/active"],
  });

  const { data: tradesHistory = [] } = useQuery<Trade[]>({
    queryKey: ["/api/trades/history"],
  });

  const { data: recentLogs = [], isLoading: logsLoading } = useQuery<ActivityLog[]>({
    queryKey: ["/api/logs/recent"],
  });

  const { data: stats, isLoading: statsLoading } = useQuery<{
    totalBalance: number;
    todayProfit: number;
    todayProfitPercent: number;
    activeTrades: number;
    successRate: number;
  }>({
    queryKey: ["/api/stats/summary"],
  });

  interface Position {
    symbol: string;
    side: string;
    entryPrice: number;
    quantity: number;
    unrealizedPnl: number;
    leverage: number;
  }

  const { data: accountInfo } = useQuery<{
    connected: boolean;
    error?: string;
    message?: string;
    totalBalance: number;
    availableBalance: number;
    positions?: Position[];
  }>({
    queryKey: ["/api/account"],
    refetchInterval: 10000,
  });

  const enrichedTrades = useMemo(() => {
    if (!accountInfo?.positions || activeTrades.length === 0) {
      return activeTrades;
    }
    
    return activeTrades.map(trade => {
      const tradeSymbol = trade.symbol.replace('/', '');
      const tradeSide = trade.type === 'long' ? 'LONG' : 'SHORT';
      
      const position = accountInfo.positions?.find(
        p => p.symbol === tradeSymbol && p.side === tradeSide
      );
      
      if (position && position.unrealizedPnl !== undefined) {
        const notionalValue = trade.entryPrice * trade.quantity;
        const profitPercent = notionalValue > 0 
          ? (position.unrealizedPnl / notionalValue) * 100 * (trade.leverage || 1)
          : 0;
        
        return {
          ...trade,
          profit: position.unrealizedPnl,
          profitPercent,
        };
      }
      
      return trade;
    });
  }, [activeTrades, accountInfo?.positions]);

  interface MarketData {
    symbol: string;
    price: number;
    priceChange24h: number;
    priceChangePercent24h: number;
  }

  const { data: btcMarket } = useQuery<MarketData>({
    queryKey: ["/api/market/BTCUSDT"],
    refetchInterval: 30000,
  });

  const { data: ethMarket } = useQuery<MarketData>({
    queryKey: ["/api/market/ETHUSDT"],
    refetchInterval: 30000,
  });

  const { data: bnbMarket } = useQuery<MarketData>({
    queryKey: ["/api/market/BNBUSDT"],
    refetchInterval: 30000,
  });

  const { data: solMarket } = useQuery<MarketData>({
    queryKey: ["/api/market/SOLUSDT"],
    refetchInterval: 30000,
  });

  const marketData: MarketTicker[] = useMemo(() => {
    const tickers: MarketTicker[] = [];
    if (btcMarket) {
      tickers.push({
        symbol: "BTC/USDT",
        price: btcMarket.price,
        change: btcMarket.priceChange24h,
        changePercent: btcMarket.priceChangePercent24h,
      });
    }
    if (ethMarket) {
      tickers.push({
        symbol: "ETH/USDT",
        price: ethMarket.price,
        change: ethMarket.priceChange24h,
        changePercent: ethMarket.priceChangePercent24h,
      });
    }
    if (bnbMarket) {
      tickers.push({
        symbol: "BNB/USDT",
        price: bnbMarket.price,
        change: bnbMarket.priceChange24h,
        changePercent: bnbMarket.priceChangePercent24h,
      });
    }
    if (solMarket) {
      tickers.push({
        symbol: "SOL/USDT",
        price: solMarket.price,
        change: solMarket.priceChange24h,
        changePercent: solMarket.priceChangePercent24h,
      });
    }
    return tickers;
  }, [btcMarket, ethMarket, bnbMarket, solMarket]);

  const profitChartData = useMemo(() => {
    const months = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", 
                    "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
    
    const closedTrades = tradesHistory.filter(t => t.status === "closed" && t.exitTime);
    if (closedTrades.length === 0) {
      return [];
    }

    const monthlyProfit: Record<number, number> = {};
    closedTrades.forEach(t => {
      if (t.exitTime) {
        const month = new Date(t.exitTime).getMonth();
        monthlyProfit[month] = (monthlyProfit[month] || 0) + (t.profit || 0);
      }
    });

    return Object.entries(monthlyProfit)
      .map(([month, profit]) => ({
        date: months[parseInt(month)],
        profit: Math.round(profit * 100) / 100,
      }))
      .sort((a, b) => months.indexOf(a.date) - months.indexOf(b.date));
  }, [tradesHistory]);

  const handleToggleBot = async () => {
    setIsToggling(true);
    try {
      await apiRequest("POST", "/api/bot/toggle");
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: settings?.isActive ? "تم إيقاف الروبوت" : "تم تفعيل الروبوت",
        description: settings?.isActive 
          ? "تم إيقاف التداول الآلي بنجاح" 
          : "بدأ الروبوت في البحث عن فرص التداول",
      });
    } catch (error) {
      toast({
        title: "حدث خطأ",
        description: "فشل في تغيير حالة الروبوت",
        variant: "destructive",
      });
    } finally {
      setIsToggling(false);
    }
  };

  const handleCloseTrade = async (tradeId: string) => {
    try {
      await apiRequest("POST", `/api/trades/${tradeId}/close`);
      queryClient.invalidateQueries({ queryKey: ["/api/trades/active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/logs/recent"] });
      toast({
        title: "تم إغلاق الصفقة",
        description: "تم إغلاق الصفقة بنجاح",
      });
    } catch (error) {
      toast({
        title: "حدث خطأ",
        description: "فشل في إغلاق الصفقة",
        variant: "destructive",
      });
    }
  };

  const displayBalance = accountInfo?.connected 
    ? accountInfo.totalBalance 
    : (stats?.totalBalance || 0);

  const displayStats = {
    totalBalance: displayBalance,
    todayProfit: stats?.todayProfit || 0,
    todayProfitPercent: stats?.todayProfitPercent || 0,
    activeTrades: stats?.activeTrades || activeTrades.length,
    successRate: stats?.successRate || 0,
  };

  return (
    <div className="space-y-6 p-6" data-testid="page-dashboard">
      {marketData.length > 0 && <MarketTickerBar tickers={marketData} />}

      {accountInfo && !accountInfo.connected && accountInfo.error && (
        <Alert variant="destructive" className="bg-destructive/10 border-destructive/20">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>تنبيه الاتصال</AlertTitle>
          <AlertDescription>
            {accountInfo.error === 'no_credentials' 
              ? 'لم يتم تكوين مفاتيح Binance API. الرجاء الانتقال إلى صفحة الإعدادات لإضافتها.'
              : accountInfo.error === 'connection_failed'
              ? 'تعذر الاتصال بـ Binance. قد يكون الخادم محظوراً من هذا الموقع الجغرافي. يرجى تجربة وضع الشبكة التجريبية (Testnet).'
              : 'حدث خطأ غير متوقع في الاتصال بـ Binance.'}
          </AlertDescription>
        </Alert>
      )}

      {accountInfo?.connected && (
        <Alert className="bg-green-500/10 border-green-500/20">
          <CheckCircle className="h-4 w-4 text-green-500" />
          <AlertTitle className="text-green-600 dark:text-green-400">متصل بـ Binance</AlertTitle>
          <AlertDescription className="text-green-600/80 dark:text-green-400/80">
            الرصيد المتاح: ${accountInfo.availableBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })} USDT
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32 mb-2" />
                <Skeleton className="h-4 w-20" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <StatsCard
              title="الرصيد الإجمالي"
              value={displayStats.totalBalance}
              isCurrency
              icon={<Wallet className="h-4 w-4" />}
            />
            <StatsCard
              title="ربح اليوم"
              value={displayStats.todayProfit}
              change={displayStats.todayProfitPercent}
              changeLabel="اليوم"
              isCurrency
              icon={<TrendingUp className="h-4 w-4" />}
              valueClassName={displayStats.todayProfit >= 0 ? "text-green-500" : "text-red-500"}
            />
            <StatsCard
              title="الصفقات النشطة"
              value={displayStats.activeTrades}
              icon={<Activity className="h-4 w-4" />}
            />
            <StatsCard
              title="نسبة النجاح"
              value={displayStats.successRate}
              isPercentage
              icon={<Percent className="h-4 w-4" />}
            />
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-lg font-bold">الأرباح الشهرية</CardTitle>
              <Button variant="ghost" size="icon">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]" data-testid="chart-monthly-profit">
                {profitChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={profitChartData}>
                      <defs>
                        <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="date" 
                        className="text-xs" 
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      />
                      <YAxis 
                        className="text-xs" 
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                        tickFormatter={(value) => `$${value}`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                        labelStyle={{ color: 'hsl(var(--foreground))' }}
                        formatter={(value: number) => [`$${value}`, 'الربح']}
                      />
                      <Area
                        type="monotone"
                        dataKey="profit"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorProfit)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="text-lg font-medium">لا توجد بيانات</p>
                      <p className="text-sm">ستظهر الأرباح هنا بعد إتمام الصفقات</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-lg font-bold">
                الصفقات النشطة ({enrichedTrades.length})
              </CardTitle>
              <Button variant="outline" size="sm" asChild>
                <a href="/trades" data-testid="link-view-all-trades">عرض الكل</a>
              </Button>
            </CardHeader>
            <CardContent>
              {tradesLoading ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <Skeleton key={i} className="h-[200px]" />
                  ))}
                </div>
              ) : enrichedTrades.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {enrichedTrades.slice(0, 4).map((trade) => (
                    <TradeCard
                      key={trade.id}
                      trade={trade}
                      onClose={handleCloseTrade}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Activity className="h-12 w-12 mb-4 opacity-50" />
                  <p className="text-lg font-medium">لا توجد صفقات نشطة</p>
                  <p className="text-sm">سيتم فتح الصفقات عند توفر إشارات قوية</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-bold">التحكم السريع</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  {settings?.isActive ? (
                    <Pause className="h-5 w-5 text-yellow-500" />
                  ) : (
                    <Play className="h-5 w-5 text-green-500" />
                  )}
                  <div>
                    <p className="font-medium">التداول الآلي</p>
                    <p className="text-xs text-muted-foreground">
                      {settings?.isActive ? "الروبوت نشط ويبحث عن فرص" : "الروبوت متوقف"}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={settings?.isActive || false}
                  onCheckedChange={handleToggleBot}
                  disabled={isToggling || settingsLoading}
                  data-testid="switch-bot-toggle"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">وضع الشبكة</span>
                  <span className={settings?.isTestnet ? "text-yellow-500" : "text-green-500"}>
                    {settings?.isTestnet ? "تجريبي" : "حقيقي"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">وضع التحوط</span>
                  <span className={settings?.hedgingMode ? "text-green-500" : "text-muted-foreground"}>
                    {settings?.hedgingMode ? "مفعل" : "معطل"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">نسبة المخاطرة</span>
                  <span>{settings?.maxRiskPerTrade || 2}%</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-bold">المؤشرات الفنية</CardTitle>
            </CardHeader>
            <CardContent>
              <TechnicalIndicators symbol="BTC/USDT" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-lg font-bold">آخر الأنشطة</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <a href="/history" data-testid="link-view-all-logs">عرض الكل</a>
              </Button>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-16" />
                  ))}
                </div>
              ) : (
                <ActivityLogList logs={recentLogs.slice(0, 5)} maxHeight="300px" />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
