import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Minus, Activity, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

interface SignalIndicatorProps {
  name: string;
  value: number;
  signal: "buy" | "sell" | "hold";
  description?: string;
}

export function SignalIndicator({ name, value, signal, description }: SignalIndicatorProps) {
  const safeValue = value ?? 0;
  const safeSignal = signal ?? "hold";
  
  const getSignalColor = () => {
    switch (safeSignal) {
      case "buy":
        return "text-green-500";
      case "sell":
        return "text-red-500";
      default:
        return "text-muted-foreground";
    }
  };

  const getSignalBadge = () => {
    switch (safeSignal) {
      case "buy":
        return (
          <Badge className="bg-green-500/10 text-green-600 dark:text-green-400">
            <TrendingUp className="h-3 w-3 ml-1" />
            شراء
          </Badge>
        );
      case "sell":
        return (
          <Badge className="bg-red-500/10 text-red-600 dark:text-red-400">
            <TrendingDown className="h-3 w-3 ml-1" />
            بيع
          </Badge>
        );
      default:
        return (
          <Badge className="bg-muted text-muted-foreground">
            <Minus className="h-3 w-3 ml-1" />
            انتظار
          </Badge>
        );
    }
  };

  return (
    <div className="flex items-center justify-between p-3 rounded-md bg-muted/30" data-testid={`signal-${name}`}>
      <div className="flex items-center gap-3">
        <Activity className={cn("h-4 w-4", getSignalColor())} />
        <div>
          <p className="text-sm font-medium">{name}</p>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className={cn("font-mono font-semibold text-sm", getSignalColor())}>
          {safeValue.toFixed(2)}
        </span>
        {getSignalBadge()}
      </div>
    </div>
  );
}

interface TechnicalIndicatorsDisplayProps {
  rsiValue: number;
  rsiSignal: "buy" | "sell" | "hold";
  macdValue: number;
  macdSignal: "buy" | "sell" | "hold";
  maSignal: "buy" | "sell" | "hold";
  overallSignal: "buy" | "sell" | "hold";
  signalStrength: number;
}

function TechnicalIndicatorsDisplay({
  rsiValue,
  rsiSignal,
  macdValue,
  macdSignal,
  maSignal,
  overallSignal,
  signalStrength,
}: TechnicalIndicatorsDisplayProps) {
  const getOverallBadge = () => {
    switch (overallSignal) {
      case "buy":
        return (
          <Badge className="bg-green-500 text-white text-base px-4 py-1">
            <TrendingUp className="h-4 w-4 ml-2" />
            إشارة شراء قوية
          </Badge>
        );
      case "sell":
        return (
          <Badge className="bg-red-500 text-white text-base px-4 py-1">
            <TrendingDown className="h-4 w-4 ml-2" />
            إشارة بيع قوية
          </Badge>
        );
      default:
        return (
          <Badge className="bg-muted text-muted-foreground text-base px-4 py-1">
            <Minus className="h-4 w-4 ml-2" />
            انتظار
          </Badge>
        );
    }
  };

  return (
    <>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <CardTitle className="text-lg font-bold">المؤشرات الفنية</CardTitle>
        {getOverallBadge()}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <SignalIndicator
            name="RSI"
            value={rsiValue}
            signal={rsiSignal}
            description="مؤشر القوة النسبية"
          />
          <SignalIndicator
            name="MACD"
            value={macdValue}
            signal={macdSignal}
            description="المتوسط المتحرك للتقارب والتباعد"
          />
          <SignalIndicator
            name="MA Cross"
            value={0}
            signal={maSignal}
            description="تقاطع المتوسطات المتحركة (50/200)"
          />
        </div>

        <div className="pt-4 border-t">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">قوة الإشارة</span>
            <span className="font-mono font-semibold">{signalStrength}%</span>
          </div>
          <Progress value={signalStrength} className="h-2" />
          <p className="text-xs text-muted-foreground mt-2 text-center">
            {signalStrength >= 66 ? "إشارة قوية - تأكيد من 2+ مؤشرات" : 
             signalStrength >= 33 ? "إشارة متوسطة" : "إشارة ضعيفة"}
          </p>
        </div>
      </CardContent>
    </>
  );
}

interface AnalysisResponse {
  symbol: string;
  currentPrice: number;
  rsi: { value: number; signal: "buy" | "sell" | "hold" };
  macd: { value: number; signal: "buy" | "sell" | "hold"; histogram: number };
  ma: { signal: "buy" | "sell" | "hold"; shortMA: number; longMA: number };
  overallSignal: "buy" | "sell" | "hold";
  signalStrength: number;
}

interface TechnicalIndicatorsProps {
  symbol: string;
}

export function TechnicalIndicators({ symbol }: TechnicalIndicatorsProps) {
  const formattedSymbol = symbol.replace("/", "");
  
  const { data: analysis, isLoading, error } = useQuery<AnalysisResponse>({
    queryKey: ["/api/analyze", formattedSymbol],
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <Card data-testid="technical-indicators">
        <CardHeader className="pb-3">
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
          <Skeleton className="h-16" />
        </CardContent>
      </Card>
    );
  }

  if (error || !analysis) {
    return (
      <Card data-testid="technical-indicators">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-bold">المؤشرات الفنية</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <AlertCircle className="h-8 w-8 mb-2" />
            <p className="text-sm text-center">لا تتوفر بيانات للتحليل</p>
            <p className="text-xs text-center mt-1">تأكد من الاتصال بـ Binance</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="technical-indicators">
      <TechnicalIndicatorsDisplay
        rsiValue={analysis.rsi.value}
        rsiSignal={analysis.rsi.signal}
        macdValue={analysis.macd.value}
        macdSignal={analysis.macd.signal}
        maSignal={analysis.ma.signal}
        overallSignal={analysis.overallSignal}
        signalStrength={analysis.signalStrength}
      />
    </Card>
  );
}
