import { Heart } from "lucide-react";
import { useFavorites, useToggleFavorite, type FavTarget } from "@/lib/favorites";
import { cn } from "@/lib/utils";

export function FavoriteButton({
  type, id, size = 18, className,
}: { type: FavTarget; id: string; size?: number; className?: string }) {
  const { data: favs } = useFavorites();
  const toggle = useToggleFavorite();
  const isFav = (favs ?? []).some((f: any) => f.target_type === type && f.target_id === id);

  return (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(type, id, isFav); }}
      className={cn(
        "rounded-full bg-background/80 backdrop-blur p-1.5 shadow border border-border",
        "transition hover:scale-110",
        className
      )}
      aria-label={isFav ? "إزالة من المفضلة" : "إضافة للمفضلة"}
    >
      <Heart
        style={{ width: size, height: size }}
        className={isFav ? "fill-destructive text-destructive" : "text-muted-foreground"}
      />
    </button>
  );
}
