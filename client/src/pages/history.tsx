import { useQuery } from "@tanstack/react-query";
import { TradesTable } from "@/components/trades-table";
import { ActivityLogList } from "@/components/activity-log";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  History,
  Download,
  FileText,
  Activity,
  TrendingUp,
  TrendingDown,
  Calendar,
} from "lucide-react";
import type { Trade, ActivityLog } from "@shared/schema";
import { useState } from "react";

export default function HistoryPage() {
  const [tradeFilter, setTradeFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const { data: trades = [], isLoading: tradesLoading } = useQuery<Trade[]>({
    queryKey: ["/api/trades/history"],
  });

  const { data: logs = [], isLoading: logsLoading } = useQuery<ActivityLog[]>({
    queryKey: ["/api/logs"],
  });

  const filteredTrades = trades.filter((trade) => {
    if (tradeFilter === "all") return true;
    if (tradeFilter === "profit") return (trade.profit || 0) > 0;
    if (tradeFilter === "loss") return (trade.profit || 0) < 0;
    return true;
  });

  const totalPages = Math.ceil(filteredTrades.length / pageSize);
  const paginatedTrades = filteredTrades.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const totalTrades = filteredTrades.length;
  const winningTrades = filteredTrades.filter((t) => (t.profit || 0) > 0).length;
  const losingTrades = filteredTrades.filter((t) => (t.profit || 0) < 0).length;
  const totalProfit = filteredTrades.reduce((sum, t) => sum + (t.profit || 0), 0);

  const handleExportCSV = () => {
    const headers = ["الزوج", "النوع", "سعر الدخول", "سعر الخروج", "الربح/الخسارة", "الحالة", "التاريخ"];
    const rows = filteredTrades.map((t) => [
      t.symbol,
      t.type === "long" ? "شراء" : "بيع",
      t.entryPrice,
      t.exitPrice || "-",
      t.profit || 0,
      t.status,
      t.entryTime ? new Date(t.entryTime).toLocaleDateString("ar-SA") : "-",
    ]);
    
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "trades_history.csv";
    link.click();
  };

  return (
    <div className="space-y-6 p-6" data-testid="page-history">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <History className="h-6 w-6" />
            السجل
          </h1>
          <p className="text-muted-foreground">
            عرض تاريخ الصفقات والأنشطة
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            data-testid="button-export-csv"
          >
            <Download className="h-4 w-4 ml-2" />
            تصدير CSV
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">إجمالي الصفقات</p>
                <p className="text-2xl font-bold">{totalTrades}</p>
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
                <p className="text-sm text-muted-foreground">صفقات رابحة</p>
                <p className="text-2xl font-bold text-green-500">{winningTrades}</p>
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
                <p className="text-sm text-muted-foreground">صفقات خاسرة</p>
                <p className="text-2xl font-bold text-red-500">{losingTrades}</p>
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

      <Tabs defaultValue="trades" className="space-y-4">
        <TabsList>
          <TabsTrigger value="trades" data-testid="tab-trades">
            <FileText className="h-4 w-4 ml-2" />
            الصفقات
          </TabsTrigger>
          <TabsTrigger value="logs" data-testid="tab-logs">
            <Activity className="h-4 w-4 ml-2" />
            سجل الأنشطة
          </TabsTrigger>
        </TabsList>

        <TabsContent value="trades" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-4">
              <CardTitle>تاريخ الصفقات</CardTitle>
              <Select value={tradeFilter} onValueChange={setTradeFilter}>
                <SelectTrigger className="w-[180px]" data-testid="select-trade-filter">
                  <SelectValue placeholder="فلتر" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الصفقات</SelectItem>
                  <SelectItem value="profit">صفقات رابحة</SelectItem>
                  <SelectItem value="loss">صفقات خاسرة</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              {tradesLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12" />
                  ))}
                </div>
              ) : (
                <TradesTable
                  trades={paginatedTrades}
                  showPagination={totalPages > 1}
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                سجل الأنشطة
              </CardTitle>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-16" />
                  ))}
                </div>
              ) : (
                <ActivityLogList logs={logs} maxHeight="600px" />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
