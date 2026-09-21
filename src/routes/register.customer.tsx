import { createFileRoute } from "@tanstack/react-router";
import { RegisterForm } from "@/components/RegisterForm";

export const Route = createFileRoute("/register/customer")({
  component: () => <RegisterForm kind="customer" />,
  head: () => ({
    meta: [
      { title: "تسجيل مستهلك | وصل" },
      { name: "description", content: "أنشئ حساب مستهلك في وصل واطلب احتياجاتك من بقالات الحي بعد موافقة الإدارة." },
      { property: "og:title", content: "تسجيل مستهلك | وصل" },
      { property: "og:description", content: "أنشئ حساب مستهلك في وصل واطلب احتياجاتك من بقالات الحي." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});
