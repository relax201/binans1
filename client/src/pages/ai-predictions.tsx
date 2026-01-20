import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Brain, TrendingUp, TrendingDown, Minus, Activity, BarChart3, Eye, Zap, AlertTriangle, Shield, RefreshCw } from "lucide-react";
import { useState } from "react";
import { queryClient } from "@/lib/queryClient";

interface AISignal {
  signal: 'buy' | 'sell' | 'hold';
  strength: number;
  confidence: number;
  description: string;
}

interface PatternResult {
  pattern: string;
  signal: 'buy' | 'sell' | 'hold';
  strength: number;
  description: string;
}

interface AIPrediction {
  overallSignal: 'buy' | 'sell' | 'hold';
  confidence: number;
  signalStrength: number;
  predictions: {
    patternRecognition: AISignal;
    momentumAnalysis: AISignal;
    volatilityAnalysis: AISignal;
    trendStrength: AISignal;
    priceAction: AISignal;
  };
  detectedPatterns: PatternResult[];
  marketRegime: 'trending_up' | 'trending_down' | 'ranging' | 'volatile';
  riskLevel: 'low' | 'medium' | 'high';
  shortTermPrediction: 'bullish' | 'bearish' | 'neutral';
  mediumTermPrediction: 'bullish' | 'bearish' | 'neutral';
}

interface PredictionData {
  symbol: string;
  currentPrice: number;
  prediction: AIPrediction;
}

interface AllPredictionsResponse {
  timeframe: string;
  predictions: PredictionData[];
  timestamp: string;
}

function getSignalColor(signal: string) {
  switch (signal) {
    case 'buy':
    case 'bullish':
      return 'text-green-500';
    case 'sell':
    case 'bearish':
      return 'text-red-500';
    default:
      return 'text-yellow-500';
  }
}

function getSignalBadgeVariant(signal: string): "default" | "secondary" | "destructive" | "outline" {
  switch (signal) {
    case 'buy':
    case 'bullish':
      return 'default';
    case 'sell':
    case 'bearish':
      return 'destructive';
    default:
      return 'secondary';
  }
}

function getSignalIcon(signal: string) {
  switch (signal) {
    case 'buy':
    case 'bullish':
      return <TrendingUp className="h-4 w-4" />;
    case 'sell':
    case 'bearish':
      return <TrendingDown className="h-4 w-4" />;
    default:
      return <Minus className="h-4 w-4" />;
  }
}

function getSignalText(signal: string) {
  switch (signal) {
    case 'buy':
      return 'شراء';
    case 'sell':
      return 'بيع';
    case 'bullish':
      return 'صعودي';
    case 'bearish':
      return 'هبوطي';
    case 'hold':
      return 'انتظار';
    default:
      return 'محايد';
  }
}

function getMarketRegimeText(regime: string) {
  switch (regime) {
    case 'trending_up':
      return 'اتجاه صاعد';
    case 'trending_down':
      return 'اتجاه هابط';
    case 'ranging':
      return 'حركة جانبية';
    case 'volatile':
      return 'تقلب عالي';
    default:
      return regime;
  }
}

function getRiskLevelText(level: string) {
  switch (level) {
    case 'low':
      return 'منخفض';
    case 'medium':
      return 'متوسط';
    case 'high':
      return 'مرتفع';
    default:
      return level;
  }
}

function getRiskColor(level: string) {
  switch (level) {
    case 'low':
      return 'text-green-500';
    case 'medium':
      return 'text-yellow-500';
    case 'high':
      return 'text-red-500';
    default:
      return 'text-muted-foreground';
  }
}

function AISignalCard({ title, signal, icon }: { title: string; signal: AISignal; icon: React.ReactNode }) {
  return (
    <div className="p-3 rounded-md bg-muted/50">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-sm font-medium">{title}</span>
      </div>
      <div className="flex items-center justify-between mb-2">
        <Badge variant={getSignalBadgeVariant(signal.signal)} className="gap-1">
          {getSignalIcon(signal.signal)}
          {getSignalText(signal.signal)}
        </Badge>
        <span className="text-xs text-muted-foreground">ثقة: {signal.confidence}%</span>
      </div>
      <Progress value={signal.strength} className="h-1.5 mb-1" />
      <p className="text-xs text-muted-foreground">{signal.description}</p>
    </div>
  );
}

function PredictionCard({ data }: { data: PredictionData }) {
  const { prediction, symbol, currentPrice } = data;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">{symbol}</CardTitle>
          </div>
          <Badge variant={getSignalBadgeVariant(prediction.overallSignal)} className="gap-1 text-sm">
            {getSignalIcon(prediction.overallSignal)}
            {getSignalText(prediction.overallSignal)}
          </Badge>
        </div>
        <CardDescription className="flex items-center gap-4 flex-wrap">
          <span>السعر: ${currentPrice.toLocaleString()}</span>
          <span className={getRiskColor(prediction.riskLevel)}>
            <Shield className="h-3 w-3 inline ml-1" />
            خطورة: {getRiskLevelText(prediction.riskLevel)}
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-md bg-muted/50">
            <div className="text-xs text-muted-foreground mb-1">قوة الإشارة</div>
            <div className="flex items-center gap-2">
              <Progress value={prediction.signalStrength} className="h-2 flex-1" />
              <span className="text-sm font-medium">{prediction.signalStrength}%</span>
            </div>
          </div>
          <div className="p-3 rounded-md bg-muted/50">
            <div className="text-xs text-muted-foreground mb-1">الثقة</div>
            <div className="flex items-center gap-2">
              <Progress value={prediction.confidence} className="h-2 flex-1" />
              <span className="text-sm font-medium">{prediction.confidence}%</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-md bg-muted/50">
            <div className="text-xs text-muted-foreground mb-1">حالة السوق</div>
            <div className="text-sm font-medium">{getMarketRegimeText(prediction.marketRegime)}</div>
          </div>
          <div className="p-3 rounded-md bg-muted/50">
            <div className="text-xs text-muted-foreground mb-1">التوقعات</div>
            <div className="flex gap-2">
              <Badge variant="outline" className={`text-xs ${getSignalColor(prediction.shortTermPrediction)}`}>
                قصير: {getSignalText(prediction.shortTermPrediction)}
              </Badge>
              <Badge variant="outline" className={`text-xs ${getSignalColor(prediction.mediumTermPrediction)}`}>
                متوسط: {getSignalText(prediction.mediumTermPrediction)}
              </Badge>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-medium">تحليل الذكاء الاصطناعي</h4>
          <div className="grid gap-2">
            <AISignalCard
              title="الأنماط السعرية"
              signal={prediction.predictions.patternRecognition}
              icon={<Eye className="h-4 w-4 text-purple-500" />}
            />
            <AISignalCard
              title="تحليل الزخم"
              signal={prediction.predictions.momentumAnalysis}
              icon={<Zap className="h-4 w-4 text-orange-500" />}
            />
            <AISignalCard
              title="تحليل التقلب"
              signal={prediction.predictions.volatilityAnalysis}
              icon={<Activity className="h-4 w-4 text-blue-500" />}
            />
            <AISignalCard
              title="قوة الاتجاه"
              signal={prediction.predictions.trendStrength}
              icon={<BarChart3 className="h-4 w-4 text-green-500" />}
            />
            <AISignalCard
              title="حركة السعر"
              signal={prediction.predictions.priceAction}
              icon={<TrendingUp className="h-4 w-4 text-cyan-500" />}
            />
          </div>
        </div>

        {prediction.detectedPatterns.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">الأنماط المكتشفة</h4>
            <div className="flex flex-wrap gap-2">
              {prediction.detectedPatterns.map((pattern, index) => (
                <Badge key={index} variant={getSignalBadgeVariant(pattern.signal)} className="gap-1">
                  {getSignalIcon(pattern.signal)}
                  {pattern.pattern}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PredictionSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-6 w-20" />
        </div>
        <Skeleton className="h-4 w-48 mt-2" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function AIPredictionsPage() {
  const [timeframe, setTimeframe] = useState('1h');

  const { data, isLoading, isRefetching } = useQuery<AllPredictionsResponse>({
    queryKey: ['/api/ai-predictions/all', timeframe],
    refetchInterval: 60000,
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/ai-predictions/all', timeframe] });
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            تنبؤات الذكاء الاصطناعي
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            تحليل متقدم باستخدام خوارزميات التعرف على الأنماط وتحليل الزخم
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={timeframe} onValueChange={setTimeframe}>
            <SelectTrigger className="w-32" data-testid="select-timeframe">
              <SelectValue placeholder="الإطار الزمني" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="15m">15 دقيقة</SelectItem>
              <SelectItem value="1h">ساعة</SelectItem>
              <SelectItem value="4h">4 ساعات</SelectItem>
              <SelectItem value="1d">يوم</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={isRefetching}
            data-testid="button-refresh-predictions"
          >
            <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <Card className="bg-yellow-500/10 border-yellow-500/30">
        <CardContent className="p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">تنبيه مهم</p>
            <p className="text-sm text-muted-foreground">
              هذه التنبؤات مبنية على التحليل الفني وليست نصيحة مالية. تداول بمسؤولية وفقاً لإدارة المخاطر الخاصة بك.
            </p>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <PredictionSkeleton />
          <PredictionSkeleton />
          <PredictionSkeleton />
        </div>
      ) : data?.predictions && data.predictions.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {data.predictions.map((pred) => (
            <PredictionCard key={pred.symbol} data={pred} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <Brain className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">لا توجد تنبؤات متاحة حالياً</p>
            <p className="text-sm text-muted-foreground mt-1">تأكد من إضافة أزواج التداول في الإعدادات</p>
          </CardContent>
        </Card>
      )}

      {data?.timestamp && (
        <p className="text-xs text-muted-foreground text-center">
          آخر تحديث: {new Date(data.timestamp).toLocaleString('ar-SA')}
        </p>
      )}
    </div>
  );
}
