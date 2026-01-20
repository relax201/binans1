import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: React.ReactNode;
  className?: string;
  valueClassName?: string;
  isCurrency?: boolean;
  isPercentage?: boolean;
}

export function StatsCard({
  title,
  value,
  change,
  changeLabel,
  icon,
  className,
  valueClassName,
  isCurrency = false,
  isPercentage = false,
}: StatsCardProps) {
  const formattedValue = isCurrency
    ? `$${Number(value).toLocaleString("en-US", { minimumFractionDigits: 2 })}`
    : isPercentage
    ? `${Number(value).toFixed(1)}%`
    : value;

  const isPositive = change !== undefined && change > 0;
  const isNegative = change !== undefined && change < 0;
  const isNeutral = change === undefined || change === 0;

  return (
    <Card className={cn("relative overflow-visible", className)} data-testid={`card-stats-${title.replace(/\s+/g, '-').toLowerCase()}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {icon && (
          <div className="text-muted-foreground">
            {icon}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className={cn("text-2xl font-bold font-mono", valueClassName)}>
          {formattedValue}
        </div>
        {change !== undefined && (
          <div className="flex items-center gap-1 mt-2">
            {isPositive && (
              <TrendingUp className="h-4 w-4 text-green-500" />
            )}
            {isNegative && (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
            {isNeutral && (
              <Minus className="h-4 w-4 text-muted-foreground" />
            )}
            <span
              className={cn(
                "text-sm font-medium",
                isPositive && "text-green-500",
                isNegative && "text-red-500",
                isNeutral && "text-muted-foreground"
              )}
            >
              {isPositive && "+"}
              {change?.toFixed(2)}%
            </span>
            {changeLabel && (
              <span className="text-xs text-muted-foreground mr-1">
                {changeLabel}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
