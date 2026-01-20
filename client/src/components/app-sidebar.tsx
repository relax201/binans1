import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  TrendingUp,
  History,
  Settings,
  BarChart3,
  Activity,
  Bot,
  Wifi,
  WifiOff,
  Brain,
} from "lucide-react";
import { cn } from "@/lib/utils";

const menuItems = [
  {
    title: "لوحة التحكم",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "الصفقات النشطة",
    url: "/trades",
    icon: TrendingUp,
  },
  {
    title: "تنبؤات AI",
    url: "/ai-predictions",
    icon: Brain,
  },
  {
    title: "السجل",
    url: "/history",
    icon: History,
  },
  {
    title: "الإحصائيات",
    url: "/stats",
    icon: BarChart3,
  },
  {
    title: "الإعدادات",
    url: "/settings",
    icon: Settings,
  },
];

interface AppSidebarProps {
  isConnected?: boolean;
  balance?: number;
  botActive?: boolean;
}

export function AppSidebar({ 
  isConnected = false, 
  balance = 0,
  botActive = false 
}: AppSidebarProps) {
  const [location] = useLocation();

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Bot className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Trading Bot</h2>
            <p className="text-xs text-muted-foreground">روبوت التداول الآلي</p>
          </div>
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs text-muted-foreground">
            القائمة الرئيسية
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      className={cn(
                        isActive && "bg-sidebar-accent text-sidebar-accent-foreground"
                      )}
                    >
                      <Link href={item.url} data-testid={`link-nav-${item.url.replace('/', '') || 'dashboard'}`}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-auto">
          <SidebarGroupLabel className="text-xs text-muted-foreground">
            حالة الروبوت
          </SidebarGroupLabel>
          <SidebarGroupContent className="px-2 space-y-3">
            <div className="flex items-center justify-between py-2 px-3 rounded-md bg-sidebar-accent/50">
              <div className="flex items-center gap-2">
                {isConnected ? (
                  <Wifi className="h-4 w-4 text-green-500" />
                ) : (
                  <WifiOff className="h-4 w-4 text-red-500" />
                )}
                <span className="text-sm">اتصال API</span>
              </div>
              <div className={cn(
                "h-2 w-2 rounded-full",
                isConnected ? "bg-green-500" : "bg-red-500"
              )} />
            </div>

            <div className="flex items-center justify-between py-2 px-3 rounded-md bg-sidebar-accent/50">
              <div className="flex items-center gap-2">
                <Activity className={cn(
                  "h-4 w-4",
                  botActive ? "text-green-500" : "text-muted-foreground"
                )} />
                <span className="text-sm">التداول الآلي</span>
              </div>
              <div className={cn(
                "h-2 w-2 rounded-full",
                botActive ? "bg-green-500 animate-pulse" : "bg-muted-foreground"
              )} />
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">الرصيد الإجمالي</p>
          <p className="text-2xl font-bold font-mono text-primary">
            ${balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
