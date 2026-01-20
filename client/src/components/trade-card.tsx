import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { X, TrendingUp, TrendingDown, Clock, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Trade } from "@shared/schema";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

interface TradeCardProps {
  trade: Trade;
  onClose?: (tradeId: string) => void;
  isClosing?: boolean;
}

export function TradeCard({ trade, onClose, isClosing }: TradeCardProps) {
  const isLong = trade.type === "long";
  const currentPrice = trade.exitPrice || trade.entryPrice;
  const pnl = trade.profit || 0;
  const pnlPercent = trade.profitPercent || 0;
  const isProfit = pnl >= 0;

  const slDistance = Math.abs(trade.entryPrice - trade.stopLoss);
  const tpDistance = Math.abs(trade.takeProfit - trade.entryPrice);
  const currentDistance = Math.abs(currentPrice - trade.entryPrice);
  
  let progressPercent = 0;
  if (isLong) {
    if (currentPrice >= trade.entryPrice) {
      progressPercent = Math.min((currentDistance / tpDistance) * 100, 100);
    } else {
      progressPercent = -Math.min((currentDistance / slDistance) * 100, 100);
    }
  } else {
    if (currentPrice <= trade.entryPrice) {
      progressPercent = Math.min((currentDistance / tpDistance) * 100, 100);
    } else {
      progressPercent = -Math.min((currentDistance / slDistance) * 100, 100);
    }
  }

  const normalizedProgress = ((progressPercent + 100) / 200) * 100;

  return (
    <Card className={cn(
      "relative overflow-visible transition-all",
      trade.status === "active" && "border-primary/30"
    )} data-testid={`card-trade-${trade.id}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <div className="flex items-center gap-3">
          <CardTitle className="text-lg font-bold">{trade.symbol}</CardTitle>
          <Badge
            variant={isLong ? "default" : "destructive"}
            className={cn(
              "text-xs font-semibold",
              isLong ? "bg-green-500/10 text-green-600 dark:text-green-400" : "bg-red-500/10 text-red-600 dark:text-red-400"
            )}
          >
            {isLong ? (
              <TrendingUp className="h-3 w-3 ml-1" />
            ) : (
              <TrendingDown className="h-3 w-3 ml-1" />
            )}
            {isLong ? "شراء" : "بيع"}
          </Badge>
          {trade.leverage && trade.leverage > 1 && (
            <Badge variant="outline" className="text-xs">
              {trade.leverage}x
            </Badge>
          )}
        </div>
        <Badge
          variant={trade.status === "active" ? "default" : "secondary"}
          className={cn(
            "text-xs",
            trade.status === "active" && "bg-primary/10 text-primary"
          )}
        >
          {trade.status === "active" ? "نشط" : 
           trade.status === "closed" ? "مغلق" :
           trade.status === "pending" ? "معلق" : "ملغي"}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">سعر الدخول</p>
            <p className="font-mono font-semibold text-sm">
              ${trade.entryPrice.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">الكمية</p>
            <p className="font-mono font-semibold text-sm">
              {trade.quantity.toLocaleString("en-US", { minimumFractionDigits: 4 })}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-red-500">وقف الخسارة</p>
            <p className="font-mono font-semibold text-sm text-red-500">
              ${trade.stopLoss.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-green-500">جني الأرباح</p>
            <p className="font-mono font-semibold text-sm text-green-500">
              ${trade.takeProfit.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {trade.status === "active" && trade.trailingStopActive && (
          <div className="grid grid-cols-3 gap-2 p-2 rounded-md bg-muted/50">
            <div className="space-y-1 text-center">
              <p className="text-xs text-muted-foreground">الربح الحالي</p>
              <p className={cn(
                "font-mono font-semibold text-sm",
                pnlPercent >= 0 ? "text-green-500" : "text-red-500"
              )}>
                {pnlPercent >= 0 ? "+" : ""}{pnlPercent.toFixed(2)}%
              </p>
            </div>
            <div className="space-y-1 text-center">
              <p className="text-xs text-muted-foreground">أعلى ربح</p>
              <p className="font-mono font-semibold text-sm text-blue-500">
                {(trade.highestPrice && trade.highestPrice <= 50 ? trade.highestPrice : 0).toFixed(2)}%
              </p>
            </div>
            <div className="space-y-1 text-center">
              <p className="text-xs text-muted-foreground">الوقف المتحرك</p>
              <p className={cn(
                "font-mono font-semibold text-sm",
                trade.trailingStopPrice ? "text-orange-500" : "text-muted-foreground"
              )}>
                {trade.trailingStopPrice 
                  ? `$${trade.trailingStopPrice.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                  : "غير مفعل"
                }
              </p>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>SL</span>
            <span>سعر الدخول</span>
            <span>TP</span>
          </div>
          <div className="relative">
            <Progress 
              value={normalizedProgress} 
              className="h-2"
            />
            <div 
              className="absolute top-0 w-0.5 h-2 bg-foreground/50"
              style={{ left: '50%', transform: 'translateX(-50%)' }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-2">
            <DollarSign className={cn(
              "h-5 w-5",
              isProfit ? "text-green-500" : "text-red-500"
            )} />
            <div>
              <p className={cn(
                "text-xl font-bold font-mono",
                isProfit ? "text-green-500" : "text-red-500"
              )}>
                {isProfit ? "+" : ""}{pnl.toLocaleString("en-US", { minimumFractionDigits: 2 })}$
              </p>
              <p className={cn(
                "text-xs font-mono",
                isProfit ? "text-green-500/70" : "text-red-500/70"
              )}>
                {isProfit ? "+" : ""}{pnlPercent.toFixed(2)}%
              </p>
            </div>
          </div>

          {trade.status === "active" && onClose && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => onClose(trade.id)}
              disabled={isClosing}
              data-testid={`button-close-trade-${trade.id}`}
            >
              <X className="h-4 w-4 ml-1" />
              إغلاق
            </Button>
          )}
        </div>

        {trade.entryTime && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>
              {format(new Date(trade.entryTime), "PPpp", { locale: ar })}
            </span>
          </div>
        )}

        {trade.entrySignals && trade.entrySignals.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-2">
            {trade.entrySignals.map((signal, index) => (
              <Badge key={index} variant="outline" className="text-xs">
                {signal}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
