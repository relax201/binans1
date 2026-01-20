import { useQuery, useMutation } from "@tanstack/react-query";
import { TradeCard } from "@/components/trade-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Activity,
  Filter,
  Search,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  XCircle,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import type { Trade } from "@shared/schema";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface BinancePosition {
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  quantity: number;
  unrealizedPnl: number;
  leverage: number;
}

interface AccountInfo {
  connected: boolean;
  error?: string;
  message?: string;
  totalBalance: number;
  availableBalance: number;
  positions: BinancePosition[];
}

interface EnrichedPosition extends BinancePosition {
  profitPercent?: number;
  highestProfit?: number;
  trailingStopPrice?: number | null;
  trailingStopActive?: boolean | null;
}

export default function TradesPage() {
  const { toast } = useToast();
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [symbolFilter, setSymbolFilter] = useState<string>("");

  const { data: accountInfo, isLoading, refetch, isFetching } = useQuery<AccountInfo>({
    queryKey: ["/api/account"],
    refetchInterval: 10000,
  });

  const { data: activeTrades } = useQuery<Trade[]>({
    queryKey: ["/api/trades/active"],
    refetchInterval: 10000,
  });

  const closeTradeMutation = useMutation({
    mutationFn: async (tradeId: string) => {
      return apiRequest("POST", `/api/trades/${tradeId}/close`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trades/active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trades/history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/summary"] });
      toast({
        title: "تم إغلاق الصفقة",
        description: "تم إغلاق الصفقة بنجاح",
      });
    },
    onError: () => {
      toast({
        title: "حدث خطأ",
        description: "فشل في إغلاق الصفقة",
        variant: "destructive",
      });
    },
  });

  const closeAllMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/trades/close-all");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trades/active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trades/history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/summary"] });
      toast({
        title: "تم إغلاق جميع الصفقات",
        description: "تم إغلاق جميع الصفقات النشطة بنجاح",
      });
    },
    onError: () => {
      toast({
        title: "حدث خطأ",
        description: "فشل في إغلاق الصفقات",
        variant: "destructive",
      });
    },
  });

  const positions = accountInfo?.positions || [];
  const isConnected = accountInfo?.connected || false;

  // Merge Binance positions with database trades to get trailing stop info
  const enrichedPositions: EnrichedPosition[] = positions.map((pos) => {
    // Find matching trade in database
    const matchingTrade = activeTrades?.find(
      (t) => t.symbol === pos.symbol && 
             ((t.type === 'long' && pos.side === 'LONG') || (t.type === 'short' && pos.side === 'SHORT'))
    );
    
    // Calculate profit percentage
    const profitPercent = pos.side === 'LONG'
      ? ((pos.unrealizedPnl / (pos.entryPrice * pos.quantity)) * 100)
      : ((pos.unrealizedPnl / (pos.entryPrice * pos.quantity)) * 100);
    
    // Get highest profit (stored in highestPrice field)
    // Valid profit percentages should be between 0 and 100 (typically much lower)
    // A value of 0 means no profit tracked yet
    const highestProfit = matchingTrade?.highestPrice || 0;

    return {
      ...pos,
      profitPercent,
      highestProfit,
      trailingStopPrice: matchingTrade?.trailingStopPrice,
      trailingStopActive: matchingTrade?.trailingStopActive,
    };
  });

  const filteredPositions = enrichedPositions.filter((pos) => {
    const type = pos.side === 'LONG' ? 'long' : 'short';
    if (typeFilter !== "all" && type !== typeFilter) return false;
    if (symbolFilter && !pos.symbol.toLowerCase().includes(symbolFilter.toLowerCase())) return false;
    return true;
  });

  const longPositions = filteredPositions.filter((p) => p.side === "LONG");
  const shortPositions = filteredPositions.filter((p) => p.side === "SHORT");
  const totalProfit = filteredPositions.reduce((sum, p) => sum + (p.unrealizedPnl || 0), 0);

  return (
    <div className="space-y-6 p-6" data-testid="page-trades">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">الصفقات النشطة</h1>
          <p className="text-muted-foreground">
            إدارة ومتابعة جميع الصفقات المفتوحة
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            data-testid="button-refresh-trades"
          >
            <RefreshCw className={`h-4 w-4 ml-2 ${isFetching ? 'animate-spin' : ''}`} />
            تحديث
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => closeAllMutation.mutate()}
            disabled={closeAllMutation.isPending || filteredPositions.length === 0}
            data-testid="button-close-all"
          >
            <XCircle className="h-4 w-4 ml-2" />
            إغلاق الكل
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Activity className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">إجمالي الصفقات</p>
                <p className="text-2xl font-bold">{filteredPositions.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                <TrendingUp className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">صفقات شراء</p>
                <p className="text-2xl font-bold">{longPositions.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10">
                <TrendingDown className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">صفقات بيع</p>
                <p className="text-2xl font-bold">{shortPositions.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${totalProfit >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                {totalProfit >= 0 ? (
                  <TrendingUp className="h-5 w-5 text-green-500" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-red-500" />
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">إجمالي الربح</p>
                <p className={`text-2xl font-bold font-mono ${totalProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {totalProfit >= 0 ? '+' : ''}{totalProfit.toFixed(2)}$
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-4">
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            الفلاتر
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="البحث عن زوج العملة..."
                  value={symbolFilter}
                  onChange={(e) => setSymbolFilter(e.target.value)}
                  className="pr-9"
                  data-testid="input-search-symbol"
                />
              </div>
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full md:w-[180px]" data-testid="select-trade-type">
                <SelectValue placeholder="نوع الصفقة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الأنواع</SelectItem>
                <SelectItem value="long">شراء (Long)</SelectItem>
                <SelectItem value="short">بيع (Short)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {!isConnected && accountInfo?.error && (
        <Alert variant="destructive" className="bg-destructive/10 border-destructive/20">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>تنبيه الاتصال</AlertTitle>
          <AlertDescription>
            {accountInfo.error === 'no_credentials' 
              ? 'لم يتم تكوين مفاتيح Binance API. الرجاء الانتقال إلى صفحة الإعدادات لإضافتها.'
              : accountInfo.error === 'connection_failed'
              ? 'تعذر الاتصال بـ Binance. يرجى تجربة وضع الشبكة التجريبية (Testnet).'
              : 'حدث خطأ غير متوقع في الاتصال بـ Binance.'}
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[200px]" />
          ))}
        </div>
      ) : filteredPositions.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredPositions.map((position, index) => (
            <Card key={`${position.symbol}-${position.side}-${index}`} data-testid={`card-position-${index}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold">{position.symbol}</span>
                    <Badge 
                      variant={position.side === 'LONG' ? 'default' : 'destructive'}
                      className={position.side === 'LONG' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}
                    >
                      {position.side === 'LONG' ? 'شراء' : 'بيع'}
                    </Badge>
                  </div>
                  <Badge variant="outline">{position.leverage}x</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">سعر الدخول</p>
                    <p className="text-sm font-mono font-medium">
                      ${position.entryPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">الكمية</p>
                    <p className="text-sm font-mono font-medium">{position.quantity}</p>
                  </div>
                </div>
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground mb-1">الربح/الخسارة غير المحقق</p>
                  <p className={`text-xl font-bold font-mono ${position.unrealizedPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {position.unrealizedPnl >= 0 ? '+' : ''}{position.unrealizedPnl.toFixed(2)}$
                  </p>
                </div>
                
                {position.trailingStopActive && (
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">الربح %</p>
                      <p className={`text-sm font-mono font-semibold ${(position.profitPercent || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {(position.profitPercent || 0) >= 0 ? '+' : ''}{(position.profitPercent || 0).toFixed(2)}%
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">أعلى ربح</p>
                      <p className="text-sm font-mono font-semibold text-blue-500">
                        {(position.highestProfit || 0).toFixed(2)}%
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">الوقف المتحرك</p>
                      <p className={`text-sm font-mono font-semibold ${position.trailingStopPrice ? 'text-orange-500' : 'text-muted-foreground'}`}>
                        {position.trailingStopPrice 
                          ? `$${position.trailingStopPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
                          : 'غير مفعل'
                        }
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : isConnected ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <CheckCircle className="h-16 w-16 mb-4 text-green-500 opacity-50" />
            <h3 className="text-xl font-semibold mb-2">لا توجد صفقات مفتوحة</h3>
            <p className="text-muted-foreground text-center max-w-md">
              أنت متصل بـ Binance ولكن لا توجد صفقات مفتوحة حالياً. افتح صفقة جديدة من منصة Binance أو فعّل الروبوت للتداول الآلي.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <AlertTriangle className="h-16 w-16 mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-xl font-semibold mb-2">غير متصل بـ Binance</h3>
            <p className="text-muted-foreground text-center max-w-md">
              يرجى التأكد من تكوين مفاتيح API في صفحة الإعدادات وتفعيل وضع الشبكة التجريبية.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
