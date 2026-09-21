import { createFileRoute, Outlet } from "@tanstack/react-router";
import { requireMerchant } from "@/auth/guards";

export const Route = createFileRoute("/merchant")({
  beforeLoad: () => requireMerchant(),
  component: () => <Outlet />,
});
