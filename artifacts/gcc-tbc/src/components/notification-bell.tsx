import { useQueryClient } from "@tanstack/react-query";
import {
  useListMyNotifications, useGetUnreadNotificationCount, useMarkNotificationRead, useMarkAllNotificationsRead,
  getListMyNotificationsQueryKey, getGetUnreadNotificationCountQueryKey,
} from "@workspace/api-client-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, CheckCheck } from "lucide-react";

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function NotificationBell() {
  const queryClient = useQueryClient();
  const { data: countData } = useGetUnreadNotificationCount({
    query: { refetchInterval: 30_000, queryKey: getGetUnreadNotificationCountQueryKey() },
  });
  const { data: listData } = useListMyNotifications({ limit: 10 });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const unreadCount = countData?.count ?? 0;
  const notifications = listData?.notifications ?? [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListMyNotificationsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetUnreadNotificationCountQueryKey() });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="relative p-1.5 rounded-md hover:bg-muted text-muted-foreground" data-testid="button-notifications">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-destructive text-white text-[10px] font-bold flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2.5 border-b">
          <p className="text-sm font-semibold">Notifications</p>
          {unreadCount > 0 && (
            <button
              className="text-xs text-primary hover:underline flex items-center gap-1"
              onClick={() => markAllRead.mutate(undefined, { onSuccess: invalidate })}
            >
              <CheckCheck className="h-3 w-3" /> Mark all read
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No notifications yet.</p>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => !n.isRead && markRead.mutate({ id: n.id }, { onSuccess: invalidate })}
                className={`w-full text-left px-3 py-2.5 border-b last:border-b-0 hover:bg-muted/50 transition-colors ${!n.isRead ? "bg-primary/5" : ""}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">{n.title}</p>
                  {!n.isRead && <Badge className="h-1.5 w-1.5 p-0 rounded-full bg-primary flex-shrink-0 mt-1.5" />}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{timeAgo(n.createdAt)}</p>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
