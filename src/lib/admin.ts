import { ensureSession, isAdminUser } from "@/auth/store";
export async function isCurrentUserAdmin(): Promise<boolean> {
  return isAdminUser((await ensureSession()).me);
}
