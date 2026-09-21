import { useQuery, useQueryClient } from "@tanstack/react-query";
import { http } from "@/api/client";

export type FavTarget = "store" | "product";
export interface FavoritesResponse { favorites: { id: string; targetType: FavTarget; targetId: string; createdAt: string }[]; stores: Record<string, unknown>[]; products: Record<string, unknown>[] }

export function useFavorites() {
  return useQuery({
    queryKey: ["favorites"],
    queryFn: async () => {
      const r = await http.get<FavoritesResponse>("/me/favorites");
      // shape the old callers expect (snake_case rows)
      return r.favorites.map((f) => ({ id: f.id, target_type: f.targetType, target_id: f.targetId, created_at: f.createdAt }));
    },
  });
}
export function useFavoritesFull() {
  return useQuery({ queryKey: ["favorites", "full"], queryFn: () => http.get<FavoritesResponse>("/me/favorites") });
}
export function useToggleFavorite() {
  const qc = useQueryClient();
  return async (targetType: FavTarget, targetId: string, isFav: boolean) => {
    if (isFav) await http.del("/me/favorites", { target_type: targetType, target_id: targetId });
    else await http.put("/me/favorites", { target_type: targetType, target_id: targetId });
    qc.invalidateQueries({ queryKey: ["favorites"] });
  };
}
