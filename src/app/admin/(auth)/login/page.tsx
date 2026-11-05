import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LoginView } from "@/components/admin/LoginView";

export const metadata: Metadata = {
  title: "Sign in · Delta Admin",
  robots: { index: false, follow: false },
};

export default async function LoginPage() {
  if (await getSession()) redirect("/admin");
  return <LoginView />;
}
