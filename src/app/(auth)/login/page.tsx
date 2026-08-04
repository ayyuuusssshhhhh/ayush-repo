import type { Metadata } from "next";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { redirectIfAuthenticated } from "@/lib/auth/context";

export const metadata: Metadata = { title: "Sign in — SHAI Proposal Generator" };

export default async function LoginPage() {
  await redirectIfAuthenticated();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-foreground text-xl font-semibold tracking-tight">Sign in</h1>
      <LoginForm />
    </div>
  );
}
