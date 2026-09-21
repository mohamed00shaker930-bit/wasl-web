import { useQuery } from "@tanstack/react-query";
import { http } from "@/api/client";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";

type Banner = { id: string; title: string; subtitle: string | null; imageUrl: string | null; link: string | null; bgColor: string | null };

export function BannerCarousel() {
  const { data: banners } = useQuery({
    queryKey: ["banners"],
    // active banners, ordered by sort_order
    queryFn: () => http.get<Banner[]>("/banners"),
  });
  const [idx, setIdx] = useState(0);
  const items = banners ?? [];

  useEffect(() => {
    if (items.length < 2) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % items.length), 4500);
    return () => clearInterval(t);
  }, [items.length]);

  if (items.length === 0) return null;
  const active = items[idx];

  const Inner = (
    <div className="relative w-full h-32 rounded-2xl overflow-hidden shadow-md transition"
      style={{ background: active.imageUrl ? `linear-gradient(135deg, ${active.bgColor}cc, ${active.bgColor}88)` : active.bgColor || "#0d9488" }}>
      {active.imageUrl && (
        <img src={active.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-80" />
      )}
      <div className="relative h-full flex flex-col justify-center px-5 text-white">
        <h3 className="font-bold text-lg drop-shadow">{active.title}</h3>
        {active.subtitle && <p className="text-sm opacity-95">{active.subtitle}</p>}
      </div>
      {items.length > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
          {items.map((_, i) => (
            <div key={i} className={`h-1.5 rounded-full transition-all ${i === idx ? "w-5 bg-white" : "w-1.5 bg-white/50"}`} />
          ))}
        </div>
      )}
    </div>
  );

  return active.link ? <Link to={active.link as any}>{Inner}</Link> : Inner;
}
