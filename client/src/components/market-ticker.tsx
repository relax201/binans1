import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface MarketTickerProps {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
}

export function MarketTicker({ symbol, price, change, changePercent }: MarketTickerProps) {
  const safePrice = price ?? 0;
  const safeChangePercent = changePercent ?? 0;
  const isPositive = safeChangePercent > 0;
  const isNegative = safeChangePercent < 0;

  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-card rounded-md border" data-testid={`ticker-${symbol}`}>
      <div className="font-semibold text-sm">{symbol}</div>
      <div className="font-mono font-bold text-sm">
        ${safePrice.toLocaleString("en-US", { minimumFractionDigits: 2 })}
      </div>
      <div className={cn(
        "flex items-center gap-1 text-xs font-medium",
        isPositive && "text-green-500",
        isNegative && "text-red-500",
        !isPositive && !isNegative && "text-muted-foreground"
      )}>
        {isPositive && <TrendingUp className="h-3 w-3" />}
        {isNegative && <TrendingDown className="h-3 w-3" />}
        {!isPositive && !isNegative && <Minus className="h-3 w-3" />}
        <span>
          {isPositive && "+"}
          {safeChangePercent.toFixed(2)}%
        </span>
      </div>
    </div>
  );
}

interface MarketTickerBarProps {
  tickers: MarketTickerProps[];
}

export function MarketTickerBar({ tickers }: MarketTickerBarProps) {
  return (
    <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide" data-testid="market-ticker-bar">
      {tickers.map((ticker) => (
        <MarketTicker key={ticker.symbol} {...ticker} />
      ))}
    </div>
  );
}
