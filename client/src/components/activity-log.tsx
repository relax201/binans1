import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { 
  Info, 
  AlertTriangle, 
  XCircle, 
  CheckCircle, 
  Clock 
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActivityLog } from "@shared/schema";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

interface ActivityLogItemProps {
  log: ActivityLog;
}

function ActivityLogItem({ log }: ActivityLogItemProps) {
  const getIcon = () => {
    switch (log.level) {
      case "info":
        return <Info className="h-4 w-4 text-blue-500" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case "error":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      default:
        return <Info className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getBadgeVariant = () => {
    switch (log.level) {
      case "info":
        return "bg-blue-500/10 text-blue-600 dark:text-blue-400";
      case "warning":
        return "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400";
      case "error":
        return "bg-red-500/10 text-red-600 dark:text-red-400";
      case "success":
        return "bg-green-500/10 text-green-600 dark:text-green-400";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getLevelLabel = () => {
    switch (log.level) {
      case "info":
        return "معلومات";
      case "warning":
        return "تحذير";
      case "error":
        return "خطأ";
      case "success":
        return "نجاح";
      default:
        return log.level;
    }
  };

  return (
    <div 
      className="flex items-start gap-3 p-3 rounded-md hover-elevate border-b last:border-b-0"
      data-testid={`log-item-${log.id}`}
    >
      <div className="mt-0.5">{getIcon()}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Badge className={cn("text-xs font-medium", getBadgeVariant())}>
            {getLevelLabel()}
          </Badge>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {log.timestamp && format(new Date(log.timestamp), "PPpp", { locale: ar })}
          </span>
        </div>
        <p className="text-sm">{log.message}</p>
        {log.details && !log.details.startsWith('{') && (
          <p className="text-xs text-muted-foreground mt-1">
            {log.details}
          </p>
        )}
      </div>
    </div>
  );
}

interface ActivityLogListProps {
  logs: ActivityLog[];
  maxHeight?: string;
}

export function ActivityLogList({ logs, maxHeight = "400px" }: ActivityLogListProps) {
  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <Info className="h-8 w-8 mb-2" />
        <p className="text-sm">لا توجد سجلات</p>
      </div>
    );
  }

  return (
    <ScrollArea style={{ maxHeight }} className="pr-4" data-testid="activity-log-list">
      <div className="space-y-1">
        {logs.map((log) => (
          <ActivityLogItem key={log.id} log={log} />
        ))}
      </div>
    </ScrollArea>
  );
}
