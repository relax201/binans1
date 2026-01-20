import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  TrendingUp, 
  TrendingDown, 
  ExternalLink,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Trade } from "@shared/schema";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

interface TradesTableProps {
  trades: Trade[];
  onViewTrade?: (tradeId: string) => void;
  showPagination?: boolean;
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
}

export function TradesTable({
  trades,
  onViewTrade,
  showPagination = false,
  currentPage = 1,
  totalPages = 1,
  onPageChange,
}: TradesTableProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge className="bg-green-500/10 text-green-600 dark:text-green-400">
            نشط
          </Badge>
        );
      case "closed":
        return (
          <Badge className="bg-muted text-muted-foreground">
            مغلق
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400">
            معلق
          </Badge>
        );
      case "cancelled":
        return (
          <Badge className="bg-red-500/10 text-red-600 dark:text-red-400">
            ملغي
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (trades.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <TrendingUp className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-lg font-medium">لا توجد صفقات</p>
        <p className="text-sm">سيتم عرض الصفقات هنا عند فتحها</p>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="trades-table">
      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-right font-semibold">الزوج</TableHead>
              <TableHead className="text-right font-semibold">النوع</TableHead>
              <TableHead className="text-right font-semibold">سعر الدخول</TableHead>
              <TableHead className="text-right font-semibold">سعر الخروج</TableHead>
              <TableHead className="text-right font-semibold">الربح/الخسارة</TableHead>
              <TableHead className="text-right font-semibold">الحالة</TableHead>
              <TableHead className="text-right font-semibold">التاريخ</TableHead>
              <TableHead className="text-right font-semibold w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {trades.map((trade) => {
              const isLong = trade.type === "long";
              const isProfit = (trade.profit || 0) >= 0;
              
              return (
                <TableRow 
                  key={trade.id} 
                  className="hover-elevate cursor-pointer"
                  onClick={() => onViewTrade?.(trade.id)}
                  data-testid={`row-trade-${trade.id}`}
                >
                  <TableCell className="font-semibold">{trade.symbol}</TableCell>
                  <TableCell>
                    <Badge
                      className={cn(
                        "text-xs",
                        isLong 
                          ? "bg-green-500/10 text-green-600 dark:text-green-400" 
                          : "bg-red-500/10 text-red-600 dark:text-red-400"
                      )}
                    >
                      {isLong ? (
                        <TrendingUp className="h-3 w-3 ml-1" />
                      ) : (
                        <TrendingDown className="h-3 w-3 ml-1" />
                      )}
                      {isLong ? "شراء" : "بيع"}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    ${trade.entryPrice.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {trade.exitPrice 
                      ? `$${trade.exitPrice.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                      : "-"
                    }
                  </TableCell>
                  <TableCell>
                    {trade.profit !== null && trade.profit !== undefined ? (
                      <div className={cn(
                        "font-mono font-semibold",
                        isProfit ? "text-green-500" : "text-red-500"
                      )}>
                        <span>{isProfit ? "+" : ""}{trade.profit.toFixed(2)}$</span>
                        <span className="text-xs mr-1">
                          ({isProfit ? "+" : ""}{trade.profitPercent?.toFixed(2)}%)
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>{getStatusBadge(trade.status || "active")}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {trade.entryTime && format(new Date(trade.entryTime), "PP", { locale: ar })}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {showPagination && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2" data-testid="trades-pagination">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange?.(currentPage - 1)}
            disabled={currentPage <= 1}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground px-4">
            صفحة {currentPage} من {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange?.(currentPage + 1)}
            disabled={currentPage >= totalPages}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
