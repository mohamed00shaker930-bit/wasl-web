import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus } from "lucide-react";
import { http, errorMessage } from "@/api/client";
import { hasPerm } from "@/api/admin";
import { useAuth } from "@/auth/store";
import { toast } from "sonner";

export function CreateUserDialog({ onCreated }: { onCreated?: () => void }) {
  const { me } = useAuth();
  const allowed = hasPerm(me, "users.create");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [userType, setUserType] = useState("customer");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [address, setAddress] = useState("");

  if (!allowed) return null;

  const reset = () => { setPhone(""); setPassword(""); setName(""); setBusinessName(""); setCity(""); setDistrict(""); setAddress(""); setUserType("customer"); };

  const submit = async () => {
    if (!name.trim()) { toast.error("الاسم مطلوب"); return; }
    if (!/^\d{9,15}$/.test(phone.replace(/\D/g, ""))) { toast.error("رقم الجوال غير صحيح"); return; }
    if (password.length < 6) { toast.error("كلمة المرور قصيرة"); return; }
    if (userType === "merchant" && !businessName.trim()) { toast.error("اسم النشاط مطلوب"); return; }
    setBusy(true);
    try {
      // optional fields are omitted rather than sent as null (the DTO only accepts strings)
      await http.post("/admin/users", {
        phone: phone.replace(/\D/g, ""), password, name: name.trim(), user_type: userType,
        ...(businessName.trim() ? { business_name: businessName.trim() } : {}),
        ...(city.trim() ? { city: city.trim() } : {}),
        ...(district.trim() ? { district: district.trim() } : {}),
        ...(address.trim() ? { address: address.trim() } : {}),
      });
    } catch (e) {
      setBusy(false);
      toast.error(errorMessage(e, "تعذّر إنشاء المستخدم"));
      return;
    }
    setBusy(false);
    toast.success("تم إنشاء المستخدم بنجاح");
    reset(); setOpen(false); onCreated?.();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1"><UserPlus className="w-4 h-4" /> إضافة مستخدم</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>إنشاء مستخدم جديد</DialogTitle>
          <DialogDescription>أنشئ حساب عميل أو تاجر مفعّلًا مباشرة.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1">
            <Label className="text-xs">نوع الحساب</Label>
            <Select value={userType} onValueChange={setUserType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="customer">عميل</SelectItem>
                <SelectItem value="merchant">تاجر</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label className="text-xs">الاسم</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          {userType === "merchant" && <div className="space-y-1"><Label className="text-xs">اسم النشاط</Label><Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} /></div>}
          <div className="space-y-1"><Label className="text-xs">رقم الجوال</Label><Input inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="7XXXXXXXX" /></div>
          <div className="space-y-1"><Label className="text-xs">كلمة المرور</Label><Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="٦ أحرف على الأقل" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label className="text-xs">المدينة</Label><Input value={city} onChange={(e) => setCity(e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">المديرية</Label><Input value={district} onChange={(e) => setDistrict(e.target.value)} /></div>
          </div>
          <div className="space-y-1"><Label className="text-xs">العنوان</Label><Input value={address} onChange={(e) => setAddress(e.target.value)} /></div>
          <Button className="w-full" disabled={busy} onClick={submit}>{busy ? "جارٍ الإنشاء…" : "إنشاء الحساب"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
