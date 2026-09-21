import { createFileRoute } from "@tanstack/react-router";
import { RegisterForm } from "@/components/RegisterForm";

export const Route = createFileRoute("/register/merchant")({
  component: () => <RegisterForm kind="merchant" />,
  head: () => ({
    meta: [
      { title: "تسجيل تاجر | وصل" },
      { name: "description", content: "أنشئ حساب تاجر في وصل واعرض منتجات نشاطك التجاري بعد موافقة الإدارة." },
      { property: "og:title", content: "تسجيل تاجر | وصل" },
      { property: "og:description", content: "أنشئ حساب تاجر في وصل واعرض منتجات نشاطك التجاري." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});
