import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { http } from "@/api/client";
import { useAppEvent } from "./realtime";

export type AppNotification = { id: string; title: string; body: string | null; type: string; link: string | null; read_at: string | null; created_at: string };
interface ApiNotification { id: string; title: string; body: string | null; type: string; link: string | null; readAt: string | null; createdAt: string }

export function useNotifications() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["notifications"],
    queryFn: async (): Promise<AppNotification[]> => {
      const r = await http.get<{ items: ApiNotification[]; unread: number }>("/me/notifications", { limit: 50 });
      return r.items.map((n) => ({ id: n.id, title: n.title, body: n.body, type: n.type, link: n.link, read_at: n.readAt, created_at: n.createdAt }));
    },
    refetchInterval: 60_000, // fallback while SSE is disconnected
  });
  useAppEvent("notification.created", useCallback(() => { qc.invalidateQueries({ queryKey: ["notifications"] }); }, [qc]));
  return query;
}
export async function markAllRead() { await http.post("/me/notifications/read-all"); }
export async function markRead(id: string) { await http.post(`/me/notifications/${id}/read`); }
