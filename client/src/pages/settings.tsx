import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Settings,
  Key,
  LineChart,
  Shield,
  Bell,
  Save,
  TestTube,
  Wifi,
  WifiOff,
  Plus,
  X,
  Bot,
  Play,
  Pause,
  TrendingUp,
  Clock,
  Target,
  Mail,
  FileText,
  Brain,
  Layers,
  Zap,
  TrendingDown,
  ArrowUpDown,
  BarChart3,
  Filter,
  ShieldCheck,
} from "lucide-react";
import { SiTelegram } from "react-icons/si";
import type { BotSettings } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

const settingsSchema = z.object({
  binanceApiKey: z.string().optional(),
  binanceApiSecret: z.string().optional(),
  customApiUrl: z.string().optional(),
  isTestnet: z.boolean().default(true),
  hedgingMode: z.boolean().default(false),
  maxRiskPerTrade: z.number().min(0.5).max(10),
  riskRewardRatio: z.number().min(1).max(5),
  maShortPeriod: z.number().min(5).max(100),
  maLongPeriod: z.number().min(50).max(500),
  rsiPeriod: z.number().min(7).max(28),
  rsiOverbought: z.number().min(60).max(90),
  rsiOversold: z.number().min(10).max(40),
  macdFast: z.number().min(5).max(20),
  macdSlow: z.number().min(20).max(50),
  macdSignal: z.number().min(5).max(15),
  tradingPairs: z.array(z.string()).default([]),
  telegramBotToken: z.string().optional(),
  telegramChatId: z.string().optional(),
  emailNotifications: z.boolean().default(false),
  notificationEmail: z.string().email().optional().or(z.literal("")),
  autoTradingEnabled: z.boolean().default(false),
  trailingStopEnabled: z.boolean().default(false),
  trailingStopPercent: z.number().min(0.1).max(10).default(1),
  multiTimeframeEnabled: z.boolean().default(false),
  timeframes: z.array(z.string()).default(['15m', '1h', '4h']),
  // AI Trading Settings
  aiTradingEnabled: z.boolean().default(false),
  aiMinConfidence: z.number().min(30).max(95).default(70),
  aiMinSignalStrength: z.number().min(20).max(90).default(60),
  aiRequiredSignals: z.number().min(1).max(5).default(3),
  // Advanced Strategies Settings
  advancedStrategiesEnabled: z.boolean().default(false),
  enabledStrategies: z.array(z.string()).default(['breakout', 'momentum', 'meanReversion', 'swing']),
  strategyMinConfidence: z.number().min(30).max(95).default(60),
  strategyMinStrength: z.number().min(20).max(90).default(50),
  requireStrategyConsensus: z.boolean().default(false),
  // Smart Position Sizing Settings
  smartPositionSizingEnabled: z.boolean().default(false),
  atrPeriod: z.number().min(7).max(50).default(14),
  atrMultiplier: z.number().min(0.5).max(5).default(1.5),
  maxPositionPercent: z.number().min(5).max(50).default(10),
  minPositionPercent: z.number().min(0.5).max(10).default(1),
  volatilityAdjustment: z.boolean().default(true),
  // Market Filter Settings
  marketFilterEnabled: z.boolean().default(false),
  avoidHighVolatility: z.boolean().default(true),
  maxVolatilityPercent: z.number().min(2).max(15).default(5),
  trendFilterEnabled: z.boolean().default(true),
  minTrendStrength: z.number().min(10).max(80).default(25),
  avoidRangingMarket: z.boolean().default(true),
  // Account Protection Settings
  accountProtectionEnabled: z.boolean().default(false),
  maxDailyLossPercent: z.number().min(1).max(20).default(5),
  maxConcurrentTrades: z.number().min(1).max(10).default(3),
  pauseAfterConsecutiveLosses: z.number().min(2).max(10).default(3),
  diversificationEnabled: z.boolean().default(true),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

export default function SettingsPage() {
  const { toast } = useToast();
  const [newPair, setNewPair] = useState("");

  const { data: settings, isLoading } = useQuery<BotSettings>({
    queryKey: ["/api/settings"],
  });

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      binanceApiKey: "",
      binanceApiSecret: "",
      isTestnet: true,
      hedgingMode: false,
      maxRiskPerTrade: 2,
      riskRewardRatio: 1.5,
      maShortPeriod: 50,
      maLongPeriod: 200,
      rsiPeriod: 14,
      rsiOverbought: 70,
      rsiOversold: 30,
      macdFast: 12,
      macdSlow: 26,
      macdSignal: 9,
      tradingPairs: ["BTC/USDT", "ETH/USDT", "BNB/USDT", "SOL/USDT", "XRP/USDT", "ADA/USDT", "DOGE/USDT", "LINK/USDT", "AVAX/USDT", "LTC/USDT", "DOT/USDT"],
      telegramBotToken: "",
      telegramChatId: "",
      emailNotifications: false,
      notificationEmail: "",
      autoTradingEnabled: false,
      trailingStopEnabled: false,
      trailingStopPercent: 1,
      multiTimeframeEnabled: false,
      timeframes: ['15m', '1h', '4h'],
      aiTradingEnabled: false,
      aiMinConfidence: 70,
      aiMinSignalStrength: 60,
      aiRequiredSignals: 3,
      advancedStrategiesEnabled: false,
      enabledStrategies: ['breakout', 'momentum', 'meanReversion', 'swing'],
      strategyMinConfidence: 60,
      strategyMinStrength: 50,
      requireStrategyConsensus: false,
      smartPositionSizingEnabled: false,
      atrPeriod: 14,
      atrMultiplier: 1.5,
      maxPositionPercent: 10,
      minPositionPercent: 1,
      volatilityAdjustment: true,
      marketFilterEnabled: false,
      avoidHighVolatility: true,
      maxVolatilityPercent: 5,
      trendFilterEnabled: true,
      minTrendStrength: 25,
      avoidRangingMarket: true,
      accountProtectionEnabled: false,
      maxDailyLossPercent: 5,
      maxConcurrentTrades: 3,
      pauseAfterConsecutiveLosses: 3,
      diversificationEnabled: true,
    },
    values: settings ? {
      binanceApiKey: settings.binanceApiKey || "",
      binanceApiSecret: settings.binanceApiSecret || "",
      isTestnet: settings.isTestnet ?? true,
      hedgingMode: settings.hedgingMode ?? false,
      maxRiskPerTrade: settings.maxRiskPerTrade ?? 2,
      riskRewardRatio: settings.riskRewardRatio ?? 1.5,
      maShortPeriod: settings.maShortPeriod ?? 50,
      maLongPeriod: settings.maLongPeriod ?? 200,
      rsiPeriod: settings.rsiPeriod ?? 14,
      rsiOverbought: settings.rsiOverbought ?? 70,
      rsiOversold: settings.rsiOversold ?? 30,
      macdFast: settings.macdFast ?? 12,
      macdSlow: settings.macdSlow ?? 26,
      macdSignal: settings.macdSignal ?? 9,
      tradingPairs: settings.tradingPairs || ["BTC/USDT", "ETH/USDT"],
      telegramBotToken: settings.telegramBotToken || "",
      telegramChatId: settings.telegramChatId || "",
      emailNotifications: settings.emailNotifications ?? false,
      notificationEmail: settings.notificationEmail || "",
      autoTradingEnabled: settings.autoTradingEnabled ?? false,
      trailingStopEnabled: settings.trailingStopEnabled ?? false,
      trailingStopPercent: settings.trailingStopPercent ?? 1,
      multiTimeframeEnabled: settings.multiTimeframeEnabled ?? false,
      timeframes: settings.timeframes || ['15m', '1h', '4h'],
      aiTradingEnabled: settings.aiTradingEnabled ?? false,
      aiMinConfidence: settings.aiMinConfidence ?? 70,
      aiMinSignalStrength: settings.aiMinSignalStrength ?? 60,
      aiRequiredSignals: settings.aiRequiredSignals ?? 3,
      advancedStrategiesEnabled: settings.advancedStrategiesEnabled ?? false,
      enabledStrategies: settings.enabledStrategies || ['breakout', 'momentum', 'meanReversion', 'swing'],
      strategyMinConfidence: settings.strategyMinConfidence ?? 60,
      strategyMinStrength: settings.strategyMinStrength ?? 50,
      requireStrategyConsensus: settings.requireStrategyConsensus ?? false,
      smartPositionSizingEnabled: settings.smartPositionSizingEnabled ?? false,
      atrPeriod: settings.atrPeriod ?? 14,
      atrMultiplier: settings.atrMultiplier ?? 1.5,
      maxPositionPercent: settings.maxPositionPercent ?? 10,
      minPositionPercent: settings.minPositionPercent ?? 1,
      volatilityAdjustment: settings.volatilityAdjustment ?? true,
      marketFilterEnabled: settings.marketFilterEnabled ?? false,
      avoidHighVolatility: settings.avoidHighVolatility ?? true,
      maxVolatilityPercent: settings.maxVolatilityPercent ?? 5,
      trendFilterEnabled: settings.trendFilterEnabled ?? true,
      minTrendStrength: settings.minTrendStrength ?? 25,
      avoidRangingMarket: settings.avoidRangingMarket ?? true,
      accountProtectionEnabled: settings.accountProtectionEnabled ?? false,
      maxDailyLossPercent: settings.maxDailyLossPercent ?? 5,
      maxConcurrentTrades: settings.maxConcurrentTrades ?? 3,
      pauseAfterConsecutiveLosses: settings.pauseAfterConsecutiveLosses ?? 3,
      diversificationEnabled: settings.diversificationEnabled ?? true,
    } : undefined,
  });

  const autoTradingStatusQuery = useQuery<{ isRunning: boolean; enabled: boolean }>({
    queryKey: ["/api/auto-trading/status"],
    refetchInterval: 5000,
  });

  const startAutoTradingMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/auto-trading/start");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/auto-trading/status"], { isRunning: true, enabled: true });
      queryClient.invalidateQueries({ queryKey: ["/api/auto-trading/status"] });
      toast({
        title: "تم تشغيل التداول التلقائي",
        description: "سيبدأ الروبوت بفحص الإشارات وتنفيذ الصفقات",
      });
    },
    onError: () => {
      toast({
        title: "فشل تشغيل التداول التلقائي",
        description: "تأكد من إعداد مفاتيح API",
        variant: "destructive",
      });
    },
  });

  const stopAutoTradingMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/auto-trading/stop");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/auto-trading/status"], { isRunning: false, enabled: false });
      queryClient.invalidateQueries({ queryKey: ["/api/auto-trading/status"] });
      toast({
        title: "تم إيقاف التداول التلقائي",
        description: "لن يتم تنفيذ صفقات جديدة تلقائياً",
      });
    },
    onError: () => {
      toast({
        title: "حدث خطأ",
        variant: "destructive",
      });
    },
  });

  const testTelegramMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/telegram/test");
    },
    onSuccess: () => {
      toast({
        title: "تم إرسال رسالة اختبار",
        description: "تحقق من Telegram لتأكيد الاستلام",
      });
    },
    onError: () => {
      toast({
        title: "فشل الاتصال",
        description: "تأكد من صحة بيانات Telegram",
        variant: "destructive",
      });
    },
  });

  const sendReportMutation = useMutation({
    mutationFn: async (type: 'weekly' | 'monthly') => {
      return apiRequest("POST", `/api/reports/${type}`);
    },
    onSuccess: () => {
      toast({
        title: "تم إرسال التقرير",
        description: "تحقق من بريدك الإلكتروني",
      });
    },
    onError: () => {
      toast({
        title: "فشل إرسال التقرير",
        description: "تأكد من إعداد البريد الإلكتروني",
        variant: "destructive",
      });
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: SettingsFormValues) => {
      return apiRequest("PUT", "/api/settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "تم حفظ الإعدادات",
        description: "تم تحديث إعدادات الروبوت بنجاح",
      });
    },
    onError: () => {
      toast({
        title: "حدث خطأ",
        description: "فشل في حفظ الإعدادات",
        variant: "destructive",
      });
    },
  });

  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/test-connection");
    },
    onSuccess: () => {
      toast({
        title: "الاتصال ناجح",
        description: "تم الاتصال بـ Binance API بنجاح",
      });
    },
    onError: () => {
      toast({
        title: "فشل الاتصال",
        description: "تأكد من صحة مفاتيح API",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: SettingsFormValues) => {
    updateSettingsMutation.mutate(data);
  };

  const addTradingPair = () => {
    if (!newPair) return;
    const pairs = form.getValues("tradingPairs");
    if (!pairs.includes(newPair.toUpperCase())) {
      form.setValue("tradingPairs", [...pairs, newPair.toUpperCase()]);
    }
    setNewPair("");
  };

  const removeTradingPair = (pair: string) => {
    const pairs = form.getValues("tradingPairs");
    form.setValue("tradingPairs", pairs.filter((p) => p !== pair));
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[600px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6" data-testid="page-settings">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="h-6 w-6" />
          الإعدادات
        </h1>
        <p className="text-muted-foreground">
          تكوين إعدادات الروبوت والاتصال بـ Binance
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Tabs defaultValue="api" className="space-y-6">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="api" data-testid="tab-api">
                <Key className="h-4 w-4 ml-2" />
                API
              </TabsTrigger>
              <TabsTrigger value="strategy" data-testid="tab-strategy">
                <LineChart className="h-4 w-4 ml-2" />
                الاستراتيجية
              </TabsTrigger>
              <TabsTrigger value="risk" data-testid="tab-risk">
                <Shield className="h-4 w-4 ml-2" />
                المخاطر
              </TabsTrigger>
              <TabsTrigger value="auto" data-testid="tab-auto">
                <Bot className="h-4 w-4 ml-2" />
                التداول التلقائي
              </TabsTrigger>
              <TabsTrigger value="notifications" data-testid="tab-notifications">
                <Bell className="h-4 w-4 ml-2" />
                الإشعارات
              </TabsTrigger>
            </TabsList>

            <TabsContent value="api" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="h-5 w-5" />
                    اتصال Binance API
                  </CardTitle>
                  <CardDescription>
                    أدخل مفاتيح API الخاصة بحسابك على Binance
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <FormField
                        control={form.control}
                        name="isTestnet"
                        render={({ field }) => (
                          <FormItem className="flex items-center gap-3">
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="switch-testnet"
                              />
                            </FormControl>
                            <div>
                              <FormLabel className="text-base">وضع الاختبار (Testnet)</FormLabel>
                              <FormDescription>
                                استخدم الحساب التجريبي للتداول بأموال وهمية
                              </FormDescription>
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>
                    <Badge variant={form.watch("isTestnet") ? "secondary" : "default"}>
                      {form.watch("isTestnet") ? (
                        <>
                          <TestTube className="h-3 w-3 ml-1" />
                          تجريبي
                        </>
                      ) : (
                        <>
                          <Wifi className="h-3 w-3 ml-1" />
                          حقيقي
                        </>
                      )}
                    </Badge>
                  </div>

                  <FormField
                    control={form.control}
                    name="binanceApiKey"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>مفتاح API</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="أدخل مفتاح API..."
                            type="password"
                            data-testid="input-api-key"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="binanceApiSecret"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>المفتاح السري</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="أدخل المفتاح السري..."
                            type="password"
                            data-testid="input-api-secret"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="customApiUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>عنوان API مخصص (اختياري)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="https://your-proxy.com أو اتركه فارغاً"
                            data-testid="input-custom-api-url"
                            {...field}
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormDescription>
                          استخدم proxy أو خادم وسيط للاتصال بـ Binance من مناطق محظورة
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => testConnectionMutation.mutate()}
                    disabled={testConnectionMutation.isPending}
                    data-testid="button-test-connection"
                  >
                    {testConnectionMutation.isPending ? (
                      <Wifi className="h-4 w-4 ml-2 animate-pulse" />
                    ) : (
                      <Wifi className="h-4 w-4 ml-2" />
                    )}
                    اختبار الاتصال
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>أزواج التداول</CardTitle>
                  <CardDescription>
                    حدد أزواج العملات التي تريد التداول عليها
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="أضف زوج عملة (مثال: XRP/USDT)"
                      value={newPair}
                      onChange={(e) => setNewPair(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTradingPair())}
                      data-testid="input-new-pair"
                    />
                    <Button type="button" onClick={addTradingPair} data-testid="button-add-pair">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {form.watch("tradingPairs").map((pair) => (
                      <Badge key={pair} variant="secondary" className="text-sm py-1 px-3">
                        {pair}
                        <button
                          type="button"
                          onClick={() => removeTradingPair(pair)}
                          className="mr-2 hover:text-destructive"
                          data-testid={`button-remove-pair-${pair}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="strategy" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>المتوسطات المتحركة (MA)</CardTitle>
                  <CardDescription>
                    إعدادات تقاطع المتوسطات المتحركة
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <FormField
                    control={form.control}
                    name="maShortPeriod"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex justify-between">
                          <FormLabel>المتوسط القصير (MA)</FormLabel>
                          <span className="font-mono text-sm">{field.value}</span>
                        </div>
                        <FormControl>
                          <Slider
                            value={[field.value]}
                            onValueChange={(v) => field.onChange(v[0])}
                            min={5}
                            max={100}
                            step={1}
                            data-testid="slider-ma-short"
                          />
                        </FormControl>
                        <FormDescription>الفترة الزمنية للمتوسط قصير المدى</FormDescription>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="maLongPeriod"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex justify-between">
                          <FormLabel>المتوسط الطويل (MA)</FormLabel>
                          <span className="font-mono text-sm">{field.value}</span>
                        </div>
                        <FormControl>
                          <Slider
                            value={[field.value]}
                            onValueChange={(v) => field.onChange(v[0])}
                            min={50}
                            max={500}
                            step={10}
                            data-testid="slider-ma-long"
                          />
                        </FormControl>
                        <FormDescription>الفترة الزمنية للمتوسط طويل المدى</FormDescription>
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>مؤشر القوة النسبية (RSI)</CardTitle>
                  <CardDescription>
                    إعدادات مؤشر RSI لتحديد التشبع الشرائي والبيعي
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <FormField
                    control={form.control}
                    name="rsiPeriod"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex justify-between">
                          <FormLabel>فترة RSI</FormLabel>
                          <span className="font-mono text-sm">{field.value}</span>
                        </div>
                        <FormControl>
                          <Slider
                            value={[field.value]}
                            onValueChange={(v) => field.onChange(v[0])}
                            min={7}
                            max={28}
                            step={1}
                            data-testid="slider-rsi-period"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="rsiOversold"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex justify-between">
                            <FormLabel className="text-green-500">التشبع البيعي</FormLabel>
                            <span className="font-mono text-sm text-green-500">{field.value}</span>
                          </div>
                          <FormControl>
                            <Slider
                              value={[field.value]}
                              onValueChange={(v) => field.onChange(v[0])}
                              min={10}
                              max={40}
                              step={1}
                              className="[&_[role=slider]]:bg-green-500"
                              data-testid="slider-rsi-oversold"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="rsiOverbought"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex justify-between">
                            <FormLabel className="text-red-500">التشبع الشرائي</FormLabel>
                            <span className="font-mono text-sm text-red-500">{field.value}</span>
                          </div>
                          <FormControl>
                            <Slider
                              value={[field.value]}
                              onValueChange={(v) => field.onChange(v[0])}
                              min={60}
                              max={90}
                              step={1}
                              className="[&_[role=slider]]:bg-red-500"
                              data-testid="slider-rsi-overbought"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>مؤشر MACD</CardTitle>
                  <CardDescription>
                    إعدادات المتوسط المتحرك للتقارب والتباعد
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="macdFast"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex justify-between">
                            <FormLabel>السريع</FormLabel>
                            <span className="font-mono text-sm">{field.value}</span>
                          </div>
                          <FormControl>
                            <Slider
                              value={[field.value]}
                              onValueChange={(v) => field.onChange(v[0])}
                              min={5}
                              max={20}
                              step={1}
                              data-testid="slider-macd-fast"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="macdSlow"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex justify-between">
                            <FormLabel>البطيء</FormLabel>
                            <span className="font-mono text-sm">{field.value}</span>
                          </div>
                          <FormControl>
                            <Slider
                              value={[field.value]}
                              onValueChange={(v) => field.onChange(v[0])}
                              min={20}
                              max={50}
                              step={1}
                              data-testid="slider-macd-slow"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="macdSignal"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex justify-between">
                            <FormLabel>الإشارة</FormLabel>
                            <span className="font-mono text-sm">{field.value}</span>
                          </div>
                          <FormControl>
                            <Slider
                              value={[field.value]}
                              onValueChange={(v) => field.onChange(v[0])}
                              min={5}
                              max={15}
                              step={1}
                              data-testid="slider-macd-signal"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="risk" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    إدارة المخاطر
                  </CardTitle>
                  <CardDescription>
                    تحديد نسب المخاطرة وحماية رأس المال
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <FormField
                    control={form.control}
                    name="maxRiskPerTrade"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex justify-between">
                          <FormLabel>الحد الأقصى للمخاطرة في الصفقة</FormLabel>
                          <span className="font-mono text-sm font-bold text-primary">{field.value}%</span>
                        </div>
                        <FormControl>
                          <Slider
                            value={[field.value]}
                            onValueChange={(v) => field.onChange(v[0])}
                            min={0.5}
                            max={10}
                            step={0.5}
                            data-testid="slider-max-risk"
                          />
                        </FormControl>
                        <FormDescription>
                          نسبة المخاطرة من إجمالي رأس المال في كل صفقة (موصى به: 1-2%)
                        </FormDescription>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="riskRewardRatio"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex justify-between">
                          <FormLabel>نسبة الربح إلى المخاطرة</FormLabel>
                          <span className="font-mono text-sm font-bold text-green-500">1:{field.value}</span>
                        </div>
                        <FormControl>
                          <Slider
                            value={[field.value]}
                            onValueChange={(v) => field.onChange(v[0])}
                            min={1}
                            max={5}
                            step={0.1}
                            data-testid="slider-risk-reward"
                          />
                        </FormControl>
                        <FormDescription>
                          نسبة الربح المستهدف مقارنة بالخسارة المحتملة (موصى به: 1:1.5 أو أعلى)
                        </FormDescription>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="hedgingMode"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                        <div>
                          <FormLabel className="text-base">وضع Hedging</FormLabel>
                          <FormDescription>
                            السماح بفتح صفقات شراء وبيع في نفس الوقت لنفس الزوج
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="switch-hedging"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="auto" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bot className="h-5 w-5" />
                    التداول التلقائي
                  </CardTitle>
                  <CardDescription>
                    تفعيل وإعداد نظام التداول الآلي
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${autoTradingStatusQuery.data?.isRunning ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground'}`} />
                      <div>
                        <p className="font-medium">
                          {autoTradingStatusQuery.data?.isRunning ? 'التداول التلقائي يعمل' : 'التداول التلقائي متوقف'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {autoTradingStatusQuery.data?.isRunning 
                            ? 'يتم فحص الإشارات كل دقيقة' 
                            : 'اضغط لبدء التداول التلقائي'}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {autoTradingStatusQuery.data?.isRunning ? (
                        <Button
                          type="button"
                          variant="destructive"
                          onClick={() => stopAutoTradingMutation.mutate()}
                          disabled={stopAutoTradingMutation.isPending}
                          data-testid="button-stop-auto-trading"
                        >
                          <Pause className="h-4 w-4 ml-2" />
                          إيقاف
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          onClick={() => startAutoTradingMutation.mutate()}
                          disabled={startAutoTradingMutation.isPending}
                          data-testid="button-start-auto-trading"
                        >
                          <Play className="h-4 w-4 ml-2" />
                          تشغيل
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-4">
                    <FormField
                      control={form.control}
                      name="trailingStopEnabled"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between p-4 rounded-lg border">
                          <div className="flex items-center gap-3">
                            <Target className="h-5 w-5 text-orange-500" />
                            <div>
                              <FormLabel className="text-base">Trailing Stop-Loss</FormLabel>
                              <FormDescription>
                                تحريك وقف الخسارة تلقائياً لحماية الأرباح
                              </FormDescription>
                            </div>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="switch-trailing-stop"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    {form.watch("trailingStopEnabled") && (
                      <FormField
                        control={form.control}
                        name="trailingStopPercent"
                        render={({ field }) => (
                          <FormItem className="pr-8">
                            <div className="flex justify-between">
                              <FormLabel>نسبة Trailing Stop</FormLabel>
                              <span className="font-mono text-sm font-bold text-orange-500">{field.value}%</span>
                            </div>
                            <FormControl>
                              <Slider
                                value={[field.value]}
                                onValueChange={(v) => field.onChange(v[0])}
                                min={0.1}
                                max={5}
                                step={0.1}
                                data-testid="slider-trailing-stop"
                              />
                            </FormControl>
                            <FormDescription>
                              نسبة التتبع - سيتحرك وقف الخسارة بهذه المسافة خلف السعر
                            </FormDescription>
                          </FormItem>
                        )}
                      />
                    )}

                    <FormField
                      control={form.control}
                      name="multiTimeframeEnabled"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between p-4 rounded-lg border">
                          <div className="flex items-center gap-3">
                            <Clock className="h-5 w-5 text-blue-500" />
                            <div>
                              <FormLabel className="text-base">تحليل متعدد الأطر الزمنية</FormLabel>
                              <FormDescription>
                                تأكيد الإشارات عبر أطر زمنية متعددة (15د، 1س، 4س)
                              </FormDescription>
                            </div>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="switch-mtf"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5 text-purple-500" />
                    التداول بالذكاء الاصطناعي
                  </CardTitle>
                  <CardDescription>
                    تنفيذ الصفقات تلقائياً بناءً على تنبؤات AI القوية
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <FormField
                    control={form.control}
                    name="aiTradingEnabled"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between p-4 rounded-lg bg-purple-500/10 border border-purple-500/30">
                        <div className="flex items-center gap-3">
                          <Brain className="h-5 w-5 text-purple-500" />
                          <div>
                            <FormLabel className="text-base">تفعيل التداول بالـ AI</FormLabel>
                            <FormDescription>
                              سيقوم البوت بتنفيذ الصفقات عند وجود إشارات AI قوية
                            </FormDescription>
                          </div>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="switch-ai-trading"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {form.watch("aiTradingEnabled") && (
                    <div className="space-y-4 pr-4">
                      <FormField
                        control={form.control}
                        name="aiMinConfidence"
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex justify-between">
                              <FormLabel>الحد الأدنى للثقة</FormLabel>
                              <span className="font-mono text-sm font-bold text-purple-500">{field.value}%</span>
                            </div>
                            <FormControl>
                              <Slider
                                value={[field.value]}
                                onValueChange={(v) => field.onChange(v[0])}
                                min={30}
                                max={95}
                                step={5}
                                data-testid="slider-ai-confidence"
                              />
                            </FormControl>
                            <FormDescription>
                              الحد الأدنى لمستوى ثقة AI لتنفيذ الصفقة (موصى به: 70%+)
                            </FormDescription>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="aiMinSignalStrength"
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex justify-between">
                              <FormLabel>الحد الأدنى لقوة الإشارة</FormLabel>
                              <span className="font-mono text-sm font-bold text-purple-500">{field.value}%</span>
                            </div>
                            <FormControl>
                              <Slider
                                value={[field.value]}
                                onValueChange={(v) => field.onChange(v[0])}
                                min={20}
                                max={90}
                                step={5}
                                data-testid="slider-ai-strength"
                              />
                            </FormControl>
                            <FormDescription>
                              الحد الأدنى لقوة إشارة التداول (موصى به: 60%+)
                            </FormDescription>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="aiRequiredSignals"
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex justify-between">
                              <FormLabel>عدد الإشارات المطلوبة</FormLabel>
                              <span className="font-mono text-sm font-bold text-purple-500">{field.value}/5</span>
                            </div>
                            <FormControl>
                              <Slider
                                value={[field.value]}
                                onValueChange={(v) => field.onChange(v[0])}
                                min={1}
                                max={5}
                                step={1}
                                data-testid="slider-ai-signals"
                              />
                            </FormControl>
                            <FormDescription>
                              عدد مؤشرات AI التي يجب أن تتفق (الأنماط، الزخم، الاتجاه، التقلب، حركة السعر)
                            </FormDescription>
                          </FormItem>
                        )}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Layers className="h-5 w-5 text-orange-500" />
                    الاستراتيجيات المتقدمة
                  </CardTitle>
                  <CardDescription>
                    استراتيجيات تداول متقدمة متعددة (Breakout, Momentum, Mean Reversion, Swing)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <FormField
                    control={form.control}
                    name="advancedStrategiesEnabled"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between p-4 rounded-lg bg-orange-500/10 border border-orange-500/30">
                        <div className="flex items-center gap-3">
                          <Layers className="h-5 w-5 text-orange-500" />
                          <div>
                            <FormLabel className="text-base">تفعيل الاستراتيجيات المتقدمة</FormLabel>
                            <FormDescription>
                              سيستخدم البوت استراتيجيات متعددة لتحليل السوق وتحديد فرص التداول
                            </FormDescription>
                          </div>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="switch-advanced-strategies"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {form.watch("advancedStrategiesEnabled") && (
                    <div className="space-y-4 pr-4">
                      <div className="space-y-3">
                        <FormLabel>الاستراتيجيات المفعّلة</FormLabel>
                        <div className="grid grid-cols-2 gap-3">
                          {[
                            { value: 'breakout', label: 'اختراق', icon: Zap, description: 'كسر مستويات الدعم/المقاومة' },
                            { value: 'momentum', label: 'زخم', icon: TrendingUp, description: 'متابعة قوة الاتجاه' },
                            { value: 'meanReversion', label: 'عودة للمتوسط', icon: ArrowUpDown, description: 'التداول عند الإفراط' },
                            { value: 'swing', label: 'سوينغ', icon: TrendingDown, description: 'تداول القمم والقيعان' },
                          ].map((strategy) => {
                            const isEnabled = form.watch("enabledStrategies")?.includes(strategy.value);
                            return (
                              <div
                                key={strategy.value}
                                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                                  isEnabled 
                                    ? 'bg-orange-500/10 border-orange-500/50' 
                                    : 'hover-elevate'
                                }`}
                                onClick={() => {
                                  const current = form.getValues("enabledStrategies") || [];
                                  if (isEnabled) {
                                    form.setValue("enabledStrategies", current.filter(s => s !== strategy.value));
                                  } else {
                                    form.setValue("enabledStrategies", [...current, strategy.value]);
                                  }
                                }}
                                data-testid={`strategy-${strategy.value}`}
                              >
                                <div className="flex items-center gap-2">
                                  <strategy.icon className={`h-4 w-4 ${isEnabled ? 'text-orange-500' : ''}`} />
                                  <span className={`font-medium ${isEnabled ? 'text-orange-500' : ''}`}>
                                    {strategy.label}
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">{strategy.description}</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <FormField
                        control={form.control}
                        name="strategyMinConfidence"
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex justify-between">
                              <FormLabel>الحد الأدنى للثقة</FormLabel>
                              <span className="font-mono text-sm font-bold text-orange-500">{field.value}%</span>
                            </div>
                            <FormControl>
                              <Slider
                                value={[field.value]}
                                onValueChange={(v) => field.onChange(v[0])}
                                min={30}
                                max={95}
                                step={5}
                                data-testid="slider-strategy-confidence"
                              />
                            </FormControl>
                            <FormDescription>
                              الحد الأدنى لمستوى ثقة الاستراتيجية لتنفيذ الصفقة
                            </FormDescription>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="strategyMinStrength"
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex justify-between">
                              <FormLabel>الحد الأدنى لقوة الإشارة</FormLabel>
                              <span className="font-mono text-sm font-bold text-orange-500">{field.value}%</span>
                            </div>
                            <FormControl>
                              <Slider
                                value={[field.value]}
                                onValueChange={(v) => field.onChange(v[0])}
                                min={20}
                                max={90}
                                step={5}
                                data-testid="slider-strategy-strength"
                              />
                            </FormControl>
                            <FormDescription>
                              الحد الأدنى لقوة إشارة الاستراتيجية
                            </FormDescription>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="requireStrategyConsensus"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between p-3 rounded-lg border">
                            <div>
                              <FormLabel>طلب إجماع الاستراتيجيات</FormLabel>
                              <FormDescription>
                                تنفيذ الصفقة فقط عند اتفاق عدة استراتيجيات
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="switch-strategy-consensus"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Smart Position Sizing Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-blue-500" />
                    إدارة رأس المال الذكية
                  </CardTitle>
                  <CardDescription>
                    حساب حجم الصفقة تلقائياً بناءً على تقلب السوق (ATR)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="smartPositionSizingEnabled"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="flex items-center gap-3">
                          <BarChart3 className="h-5 w-5 text-blue-500" />
                          <div>
                            <FormLabel className="text-base">تفعيل الحجم الذكي</FormLabel>
                            <FormDescription>
                              تعديل حجم الصفقة تلقائياً حسب تقلب السوق
                            </FormDescription>
                          </div>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="switch-smart-sizing"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {form.watch("smartPositionSizingEnabled") && (
                    <div className="space-y-4 pr-4">
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="atrPeriod"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>فترة ATR</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min={7}
                                  max={50}
                                  {...field}
                                  onChange={(e) => field.onChange(parseInt(e.target.value) || 14)}
                                  data-testid="input-atr-period"
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="atrMultiplier"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>مضاعف ATR</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  step="0.1"
                                  min={0.5}
                                  max={5}
                                  {...field}
                                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 1.5)}
                                  data-testid="input-atr-multiplier"
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="maxPositionPercent"
                          render={({ field }) => (
                            <FormItem>
                              <div className="flex justify-between">
                                <FormLabel>الحد الأقصى للحجم</FormLabel>
                                <span className="font-mono text-sm text-blue-500">{field.value}%</span>
                              </div>
                              <FormControl>
                                <Slider
                                  value={[field.value]}
                                  onValueChange={(v) => field.onChange(v[0])}
                                  min={5}
                                  max={50}
                                  step={1}
                                  data-testid="slider-max-position"
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="minPositionPercent"
                          render={({ field }) => (
                            <FormItem>
                              <div className="flex justify-between">
                                <FormLabel>الحد الأدنى للحجم</FormLabel>
                                <span className="font-mono text-sm text-blue-500">{field.value}%</span>
                              </div>
                              <FormControl>
                                <Slider
                                  value={[field.value]}
                                  onValueChange={(v) => field.onChange(v[0])}
                                  min={0.5}
                                  max={10}
                                  step={0.5}
                                  data-testid="slider-min-position"
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="volatilityAdjustment"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between p-3 rounded-lg border">
                            <div>
                              <FormLabel>تعديل حسب التقلب</FormLabel>
                              <FormDescription>
                                تقليل الحجم عند ارتفاع التقلب وزيادته عند انخفاضه
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="switch-volatility-adjustment"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Market Filter Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Filter className="h-5 w-5 text-purple-500" />
                    فلتر السوق
                  </CardTitle>
                  <CardDescription>
                    تجنب التداول في ظروف السوق غير المناسبة
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="marketFilterEnabled"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="flex items-center gap-3">
                          <Filter className="h-5 w-5 text-purple-500" />
                          <div>
                            <FormLabel className="text-base">تفعيل فلتر السوق</FormLabel>
                            <FormDescription>
                              تحليل حالة السوق قبل كل صفقة
                            </FormDescription>
                          </div>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="switch-market-filter"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {form.watch("marketFilterEnabled") && (
                    <div className="space-y-4 pr-4">
                      <FormField
                        control={form.control}
                        name="avoidHighVolatility"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between p-3 rounded-lg border">
                            <div>
                              <FormLabel>تجنب التقلب العالي</FormLabel>
                              <FormDescription>
                                إيقاف التداول عند ارتفاع التقلب الشديد
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="switch-avoid-volatility"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      {form.watch("avoidHighVolatility") && (
                        <FormField
                          control={form.control}
                          name="maxVolatilityPercent"
                          render={({ field }) => (
                            <FormItem>
                              <div className="flex justify-between">
                                <FormLabel>الحد الأقصى للتقلب</FormLabel>
                                <span className="font-mono text-sm text-purple-500">{field.value}%</span>
                              </div>
                              <FormControl>
                                <Slider
                                  value={[field.value]}
                                  onValueChange={(v) => field.onChange(v[0])}
                                  min={2}
                                  max={15}
                                  step={0.5}
                                  data-testid="slider-max-volatility"
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      )}

                      <FormField
                        control={form.control}
                        name="trendFilterEnabled"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between p-3 rounded-lg border">
                            <div>
                              <FormLabel>فلتر الاتجاه</FormLabel>
                              <FormDescription>
                                التداول فقط مع الاتجاه القوي
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="switch-trend-filter"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="avoidRangingMarket"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between p-3 rounded-lg border">
                            <div>
                              <FormLabel>تجنب السوق العرضي</FormLabel>
                              <FormDescription>
                                عدم التداول عندما يكون السوق بدون اتجاه واضح
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="switch-avoid-ranging"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Account Protection Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-red-500" />
                    حماية الحساب
                  </CardTitle>
                  <CardDescription>
                    حماية رأس المال من الخسائر الكبيرة
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="accountProtectionEnabled"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="flex items-center gap-3">
                          <ShieldCheck className="h-5 w-5 text-red-500" />
                          <div>
                            <FormLabel className="text-base">تفعيل حماية الحساب</FormLabel>
                            <FormDescription>
                              إيقاف التداول عند الوصول لحدود الخسارة
                            </FormDescription>
                          </div>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="switch-account-protection"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {form.watch("accountProtectionEnabled") && (
                    <div className="space-y-4 pr-4">
                      <FormField
                        control={form.control}
                        name="maxDailyLossPercent"
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex justify-between">
                              <FormLabel>حد الخسارة اليومي</FormLabel>
                              <span className="font-mono text-sm text-red-500">{field.value}%</span>
                            </div>
                            <FormControl>
                              <Slider
                                value={[field.value]}
                                onValueChange={(v) => field.onChange(v[0])}
                                min={1}
                                max={20}
                                step={0.5}
                                data-testid="slider-daily-loss"
                              />
                            </FormControl>
                            <FormDescription>
                              إيقاف التداول عند خسارة هذه النسبة يومياً
                            </FormDescription>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="maxConcurrentTrades"
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex justify-between">
                              <FormLabel>الحد الأقصى للصفقات المتزامنة</FormLabel>
                              <span className="font-mono text-sm text-red-500">{field.value}</span>
                            </div>
                            <FormControl>
                              <Slider
                                value={[field.value]}
                                onValueChange={(v) => field.onChange(v[0])}
                                min={1}
                                max={10}
                                step={1}
                                data-testid="slider-max-concurrent"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="pauseAfterConsecutiveLosses"
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex justify-between">
                              <FormLabel>إيقاف بعد خسائر متتالية</FormLabel>
                              <span className="font-mono text-sm text-red-500">{field.value}</span>
                            </div>
                            <FormControl>
                              <Slider
                                value={[field.value]}
                                onValueChange={(v) => field.onChange(v[0])}
                                min={2}
                                max={10}
                                step={1}
                                data-testid="slider-consecutive-losses"
                              />
                            </FormControl>
                            <FormDescription>
                              إيقاف مؤقت بعد هذا العدد من الخسائر المتتالية
                            </FormDescription>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="diversificationEnabled"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between p-3 rounded-lg border">
                            <div>
                              <FormLabel>التنويع التلقائي</FormLabel>
                              <FormDescription>
                                منع فتح صفقتين على نفس العملة
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="switch-diversification"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    التقارير الدورية
                  </CardTitle>
                  <CardDescription>
                    إرسال تقارير الأداء بشكل دوري
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg border">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="h-4 w-4" />
                        <span className="font-medium">التقرير الأسبوعي</span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        يُرسل كل يوم أحد الساعة 9 صباحاً
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => sendReportMutation.mutate('weekly')}
                        disabled={sendReportMutation.isPending || !form.watch("emailNotifications")}
                        data-testid="button-send-weekly-report"
                      >
                        <Mail className="h-4 w-4 ml-2" />
                        إرسال الآن
                      </Button>
                    </div>

                    <div className="p-4 rounded-lg border">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="h-4 w-4" />
                        <span className="font-medium">التقرير الشهري</span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        يُرسل في أول كل شهر الساعة 9 صباحاً
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => sendReportMutation.mutate('monthly')}
                        disabled={sendReportMutation.isPending || !form.watch("emailNotifications")}
                        data-testid="button-send-monthly-report"
                      >
                        <Mail className="h-4 w-4 ml-2" />
                        إرسال الآن
                      </Button>
                    </div>
                  </div>
                  
                  {!form.watch("emailNotifications") && (
                    <p className="text-sm text-muted-foreground text-center">
                      قم بتفعيل إشعارات البريد الإلكتروني في تبويب الإشعارات لتلقي التقارير
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notifications" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <SiTelegram className="h-5 w-5" />
                    إشعارات Telegram
                  </CardTitle>
                  <CardDescription>
                    تلقي إشعارات فورية عبر Telegram
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="telegramBotToken"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>رمز البوت (Bot Token)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="أدخل رمز بوت Telegram..."
                            type="password"
                            data-testid="input-telegram-token"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          احصل على رمز البوت من @BotFather
                        </FormDescription>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="telegramChatId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>معرف المحادثة (Chat ID)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="أدخل معرف المحادثة..."
                            data-testid="input-telegram-chat"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          يمكنك الحصول عليه من @userinfobot
                        </FormDescription>
                      </FormItem>
                    )}
                  />

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => testTelegramMutation.mutate()}
                    disabled={testTelegramMutation.isPending || !form.watch("telegramBotToken") || !form.watch("telegramChatId")}
                    data-testid="button-test-telegram"
                  >
                    <SiTelegram className="h-4 w-4 ml-2" />
                    {testTelegramMutation.isPending ? "جاري الاختبار..." : "اختبار الاتصال"}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5" />
                    إشعارات البريد الإلكتروني
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="emailNotifications"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                        <div>
                          <FormLabel className="text-base">تفعيل إشعارات البريد</FormLabel>
                          <FormDescription>
                            تلقي إشعارات عند فتح أو إغلاق الصفقات
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="switch-email-notifications"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {form.watch("emailNotifications") && (
                    <FormField
                      control={form.control}
                      name="notificationEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>البريد الإلكتروني</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="your@email.com"
                              type="email"
                              data-testid="input-notification-email"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="sticky bottom-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-4 -mx-6 -mb-6 border-t">
            <Button
              type="submit"
              size="lg"
              className="w-full md:w-auto"
              disabled={updateSettingsMutation.isPending}
              data-testid="button-save-settings"
            >
              <Save className="h-4 w-4 ml-2" />
              {updateSettingsMutation.isPending ? "جاري الحفظ..." : "حفظ الإعدادات"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
