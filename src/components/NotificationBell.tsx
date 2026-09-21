import { Bell } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useNotifications } from "@/lib/notifications";

export function NotificationBell() {
  const { data } = useNotifications();
  const unread = (data ?? []).filter((n) => !n.read_at).length;
  return (
    <Link to="/notifications" className="relative p-2 rounded-full hover:bg-accent/50">
      <Bell className="w-5 h-5" />
      {unread > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
