import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Bell, Check, CheckCheck, Trash2, AlertTriangle, AlertCircle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useNotifications, type AppNotification } from "@/hooks/useNotifications";

const severityIcon = (severity: AppNotification["severity"]) => {
  switch (severity) {
    case "critical":
      return <AlertCircle className="h-4 w-4 text-destructive shrink-0" />;
    case "warning":
      return <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />;
    default:
      return <Info className="h-4 w-4 text-primary shrink-0" />;
  }
};

export const NotificationBell = () => {
  const navigate = useNavigate();
  const { items, unreadCount, markAsRead, markAllAsRead, remove } = useNotifications(30);

  const handleClick = (n: AppNotification) => {
    if (!n.read_at) markAsRead(n.id);
    if (n.link) navigate(n.link);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 min-w-[1.25rem] px-1 rounded-full text-[10px] font-bold flex items-center justify-center"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div>
            <h4 className="font-semibold text-sm">Notifications</h4>
            <p className="text-xs text-muted-foreground">
              {unreadCount === 0 ? "Tout est lu" : `${unreadCount} non lue${unreadCount > 1 ? "s" : ""}`}
            </p>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllAsRead()}
              className="text-xs h-8"
            >
              <CheckCheck className="h-3.5 w-3.5 mr-1" />
              Tout marquer lu
            </Button>
          )}
        </div>

        <ScrollArea className="h-[420px]">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mb-2 opacity-40" />
              <p className="text-sm">Aucune notification</p>
            </div>
          ) : (
            <ul className="divide-y">
              {items.map((n) => (
                <li
                  key={n.id}
                  className={cn(
                    "group relative px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer",
                    !n.read_at && "bg-primary/5"
                  )}
                  onClick={() => handleClick(n)}
                >
                  <div className="flex gap-3">
                    <div className="mt-0.5">{severityIcon(n.severity)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn("text-sm leading-tight", !n.read_at && "font-semibold")}>
                          {n.title}
                        </p>
                        {!n.read_at && (
                          <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />
                        )}
                      </div>
                      {n.body && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {n.body}
                        </p>
                      )}
                      <p className="text-[11px] text-muted-foreground mt-1.5">
                        {formatDistanceToNow(new Date(n.created_at), {
                          addSuffix: true,
                          locale: fr,
                        })}
                      </p>
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1">
                      {!n.read_at && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsRead(n.id);
                          }}
                          title="Marquer comme lu"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          remove(n.id);
                        }}
                        title="Supprimer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};
