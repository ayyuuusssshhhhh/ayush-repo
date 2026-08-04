import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/features/auth/components/ForgotPasswordForm";
import { redirectIfAuthenticated } from "@/lib/auth/context";

export const metadata: Metadata = { title: "Forgot password — SHAI Proposal Generator" };

export default async function ForgotPasswordPage() {
  await redirectIfAuthenticated();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-foreground text-xl font-semibold tracking-tight">Reset your password</h1>
      <ForgotPasswordForm />
    </div>
  );
}
