import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { http } from "@/api/client";
import { requireAuth } from "@/auth/guards";
import { auth } from "@/auth/store";
import { CustomerShell } from "@/components/CustomerShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star, MapPin, Store as StoreIcon, Navigation, RotateCcw, Heart, Wallet, Bell } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { FavoriteButton } from "@/components/FavoriteButton";
import { BannerCarousel } from "@/components/BannerCarousel";
import { useEffect, useMemo, useState } from "react";
import { getCachedLocation, requestCurrentPosition, haversineKm, fmtDistance, type LatLng } from "@/lib/geo";
import { cart } from "@/lib/cart";
import { fmtRial } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/home")({
  beforeLoad: async () => {
    const me = await requireAuth();
    if (auth.role(me) === "merchant") throw redirect({ to: "/merchant" });
  },
  component: HomePage,
});

function HomePage() {
  const [myLoc, setMyLoc] = useState<LatLng | null>(null);
  const [locating, setLocating] = useState(false);

  useEffect(() => { setMyLoc(getCachedLocation()); }, []);

  const detect = async () => {
    setLocating(true);
    try {
      const p = await requestCurrentPosition();
      setMyLoc(p);
      toast.success("تم تحديد موقعك — رتّبنا المتاجر بالأقرب");
    } catch { toast.error("تعذّر الحصول على الموقع"); }
    finally { setLocating(false); }
  };

  // active stores; the API sorts by distance when coordinates are sent (it used to be a client-side haversine sort)
  const { data: stores, isLoading } = useQuery({
    queryKey: ["stores", myLoc?.lat, myLoc?.lng],
    queryFn: () => http.get<any[]>("/stores", myLoc ? { lat: myLoc.lat, lng: myLoc.lng } : undefined),
  });

  const { data: recentOrders } = useQuery({
    queryKey: ["recent-orders-home"],
    queryFn: () => http.get<any[]>("/me/orders", { limit: 5 }),
  });

  const sorted = useMemo(() => {
    if (!stores) return [];
    return stores.map((s) => ({
      ...s,
      is_open: s.isOpen, delivery_info: s.deliveryInfo,
      _dist: s.distanceKm != null ? Number(s.distanceKm) : (myLoc && s.lat != null && s.lng != null ? haversineKm(myLoc, { lat: Number(s.lat), lng: Number(s.lng) }) : Infinity),
    }));
  }, [stores, myLoc]);

  const reorder = (o: any) => {
    if (!o.store?.name) return;
    cart.clear();
    for (const it of (o.items ?? [])) {
      cart.add(o.storeId, o.store.name, { productId: it.productId, name: it.name, price: Number(it.price), qty: it.qty, imageUrl: null });
    }
    toast.success("أُضيفت طلبيتك السابقة للسلة");
  };

  return (
    <CustomerShell title="بقالات قريبة منك" action={
      <Button size="sm" variant="secondary" onClick={detect} disabled={locating}>
        <Navigation className="w-4 h-4 ml-1" /> {locating ? "..." : (myLoc ? "تحديث" : "موقعي")}
      </Button>
    }>
      {/* بانرات */}
      <div className="mb-4"><BannerCarousel /></div>

      {/* اطلب مرة أخرى */}
      {(recentOrders ?? []).length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-bold text-sm flex items-center gap-1"><RotateCcw className="w-4 h-4" /> اطلب مرة أخرى</h2>
          </div>
          <div className="flex gap-3 overflow-x-auto -mx-4 px-4 pb-2 snap-x">
            {recentOrders!.map((o: any) => (
              <Card key={o.id} className="p-3 min-w-[200px] snap-start space-y-2">
                <div className="font-bold text-sm truncate">{o.store?.name}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {(o.items ?? []).slice(0, 3).map((i: any) => i.name).join("، ")}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-primary font-bold">{fmtRial(o.total)}</span>
                  <Button size="sm" className="h-7 text-xs" onClick={() => reorder(o)}>أعد الطلب</Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* روابط سريعة */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <Link to="/favorites"><Card className="p-3 flex flex-col items-center gap-1 hover:border-primary"><Heart className="w-5 h-5 text-destructive" /><span className="text-[11px] font-medium">المفضلة</span></Card></Link>
        <Link to="/wallet"><Card className="p-3 flex flex-col items-center gap-1 hover:border-primary"><Wallet className="w-5 h-5 text-primary" /><span className="text-[11px] font-medium">المحفظة</span></Card></Link>
        <Link to="/locations"><Card className="p-3 flex flex-col items-center gap-1 hover:border-primary"><MapPin className="w-5 h-5 text-primary" /><span className="text-[11px] font-medium">مواقعي</span></Card></Link>
        <Link to="/notifications"><Card className="p-3 flex flex-col items-center gap-1 hover:border-primary"><Bell className="w-5 h-5 text-warning" /><span className="text-[11px] font-medium">إشعارات</span></Card></Link>
      </div>


      <div className="space-y-3">
        {isLoading && [1,2,3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        {!isLoading && sorted.length === 0 && (
          <Card className="p-8 text-center text-muted-foreground">
            <StoreIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>لا توجد بقالات مسجلة بعد.</p>
          </Card>
        )}
        {sorted.map((s: any) => (
          <div key={s.id} className="relative">
            <FavoriteButton type="store" id={s.id} className="absolute top-3 left-3 z-10" />
            <Link to="/store/$storeId" params={{ storeId: s.id }}>
              <Card className="p-4 hover:border-primary transition">
                <div className="flex items-start gap-3">
                  <div className="w-14 h-14 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <StoreIcon className="w-7 h-7" />
                  </div>
                  <div className="flex-1 min-w-0 pl-8">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold truncate">{s.name}</h3>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${s.is_open ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                        {s.is_open ? "مفتوح" : "مغلق"}
                      </span>
                    </div>
                    {s.area && <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1"><MapPin className="w-3 h-3" />{s.area}</p>}
                    <div className="flex items-center gap-3 mt-2 text-xs">
                      <span className="flex items-center gap-1"><Star className="w-3 h-3 fill-warning text-warning" />{Number(s.rating).toFixed(1)}</span>
                      {myLoc && Number.isFinite(s._dist) && (
                        <span className="flex items-center gap-1 text-primary font-medium"><Navigation className="w-3 h-3" />{fmtDistance(s._dist)}</span>
                      )}
                      {s.delivery_info && <span className="text-muted-foreground truncate">{s.delivery_info}</span>}
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          </div>
        ))}
      </div>
    </CustomerShell>
  );
}
