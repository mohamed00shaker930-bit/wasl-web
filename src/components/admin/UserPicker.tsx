import { useEffect, useRef, useState } from "react";
import { listUsers } from "@/api/admin";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export type PickedUser = { user_id: string; name: string | null; phone: string | null };

const KIND_PARAM = { customer: "customers", merchant: "merchants", staff: "staff" } as const;

export function UserPicker({
  value,
  onChange,
  placeholder = "ابحث بالاسم أو رقم الجوال",
  kind = null,
  disabled = false,
}: {
  value: PickedUser | null;
  onChange: (u: PickedUser | null) => void;
  placeholder?: string;
  kind?: "customer" | "merchant" | "staff" | null;
  disabled?: boolean;
}) {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [results, setResults] = useState<PickedUser[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 400);
    return () => clearTimeout(t);
  }, [q]);

  // reset search state when kind changes
  useEffect(() => {
    setQ("");
    setDebounced("");
    setResults([]);
    setOpen(false);
  }, [kind]);

  const search = async (term: string | null): Promise<PickedUser[]> => {
    try {
      const r = await listUsers({ kind: kind ? KIND_PARAM[kind] : "all", search: term || undefined, limit: 20, offset: 0 });
      return r.items.map((u) => ({ user_id: u.id, name: u.name, phone: u.phone }));
    } catch {
      return [];
    }
  };

  const fetchList = async (term: string | null) => {
    setLoading(true);
    setResults(await search(term));
    setLoading(false);
  };

  // Search whenever debounced query changes (including empty → full list)
  useEffect(() => {
    if (value || disabled) return;
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const list = await search(debounced.length >= 1 ? debounced : null);
      if (cancelled) return;
      setResults(list);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [debounced, value, kind, open, disabled]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  if (value) {
    return (
      <div className="flex items-center gap-2 border rounded-md px-2 py-1.5 bg-muted/40">
        <span className="text-sm font-medium truncate flex-1">
          {value.name || "—"}
          {value.phone && <span className="text-xs text-muted-foreground mr-2 ms-2">{value.phone}</span>}
        </span>
        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => { onChange(null); setQ(""); setResults([]); }}>
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div ref={boxRef} className="relative">
      <Input
        placeholder={placeholder}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => { setOpen(true); if (results.length === 0) fetchList(null); }}
        disabled={disabled}
      />
      {!disabled && open && (
        <div className="absolute z-50 mt-1 w-full bg-popover border rounded-md shadow-md max-h-64 overflow-y-auto">
          {loading && <div className="px-3 py-2 text-xs text-muted-foreground">جاري البحث...</div>}
          {!loading && results.map((r) => (
            <button
              key={r.user_id}
              type="button"
              className="w-full text-right px-3 py-2 text-sm hover:bg-accent flex items-center gap-2 justify-between"
              onClick={() => { onChange(r); setOpen(false); setQ(""); }}
            >
              <span className="truncate">{r.name || "—"}</span>
              <span className="text-xs text-muted-foreground">{r.phone || ""}</span>
            </button>
          ))}
          {!loading && results.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground">لا نتائج</div>
          )}
        </div>
      )}
    </div>
  );
}
