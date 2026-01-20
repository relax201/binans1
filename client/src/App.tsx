import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { useWebSocket } from "./hooks/use-websocket";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { AppSidebar } from "@/components/app-sidebar";
import {
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
} from "@/components/ui/sidebar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, Search, Info, AlertTriangle, AlertCircle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import TradesPage from "@/pages/trades";
import HistoryPage from "@/pages/history";
import SettingsPage from "@/pages/settings";
import StatsPage from "@/pages/stats";
import AIPredictionsPage from "@/pages/ai-predictions";
import type { BotSettings, ActivityLog } from "@shared/schema";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/trades" component={TradesPage} />
      <Route path="/history" component={HistoryPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/stats" component={StatsPage} />
      <Route path="/ai-predictions" component={AIPredictionsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function getNotificationIcon(level: string) {
  switch (level) {
    case "success":
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case "warning":
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    case "error":
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    default:
      return <Info className="h-4 w-4 text-blue-500" />;
  }
}

function AppLayout() {
  // Initialize WebSocket connection for real-time updates
  useWebSocket();

  const { data: settings } = useQuery<BotSettings>({
    queryKey: ["/api/settings"],
  });

  const { data: stats } = useQuery<{
    totalBalance: number;
    todayProfit: number;
    activeTrades: number;
  }>({
    queryKey: ["/api/stats/summary"],
  });

  const { data: notifications = [] } = useQuery<ActivityLog[]>({
    queryKey: ["/api/logs/recent"],
    refetchInterval: 30000,
  });

  const notificationCount = notifications.length;

  const sidebarStyle = {
    "--sidebar-width": "18rem",
    "--sidebar-width-icon": "4rem",
  } as React.CSSProperties;

  return (
    <SidebarProvider style={sidebarStyle}>
      <div className="flex h-screen w-full">
        <AppSidebar
          isConnected={!!settings?.binanceApiKey}
          balance={stats?.totalBalance || 0}
          botActive={settings?.isActive || false}
        />
        <SidebarInset className="flex flex-col flex-1">
          <header className="sticky top-0 z-50 flex h-16 items-center justify-between gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
            <div className="flex items-center gap-4">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <div className="relative hidden md:block">
                <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="بحث عن زوج العملة..."
                  className="w-64 pr-9"
                  data-testid="input-search-global"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative" data-testid="button-notifications">
                    <Bell className="h-5 w-5" />
                    {notificationCount > 0 && (
                      <Badge className="absolute -top-1 -left-1 h-5 w-5 flex items-center justify-center p-0 text-xs">
                        {notificationCount > 9 ? "9+" : notificationCount}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="end">
                  <div className="p-3 border-b">
                    <h4 className="font-semibold text-sm">الإشعارات</h4>
                    <p className="text-xs text-muted-foreground">آخر {notificationCount} إشعار</p>
                  </div>
                  <ScrollArea className="h-80">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-muted-foreground">
                        <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">لا توجد إشعارات</p>
                      </div>
                    ) : (
                      <div className="divide-y">
                        {notifications.map((notification) => (
                          <div
                            key={notification.id}
                            className={cn(
                              "p-3 hover-elevate cursor-pointer",
                              notification.level === "error" && "bg-red-500/5",
                              notification.level === "warning" && "bg-yellow-500/5",
                              notification.level === "success" && "bg-green-500/5"
                            )}
                            data-testid={`notification-${notification.id}`}
                          >
                            <div className="flex gap-3">
                              <div className="flex-shrink-0 mt-0.5">
                                {getNotificationIcon(notification.level || "info")}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium">{notification.message}</p>
                                {notification.details && (
                                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                    {notification.details}
                                  </p>
                                )}
                                <p className="text-xs text-muted-foreground mt-1">
                                  {notification.timestamp
                                    ? formatDistanceToNow(new Date(notification.timestamp), {
                                        addSuffix: true,
                                        locale: ar,
                                      })
                                    : "الآن"}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </PopoverContent>
              </Popover>
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-auto bg-muted/30">
            <Router />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark" storageKey="trading-bot-theme">
        <TooltipProvider>
          <AppLayout />
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
