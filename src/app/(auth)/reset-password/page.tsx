import type { Metadata } from "next";
import { ResetPasswordForm } from "@/features/auth/components/ResetPasswordForm";

export const metadata: Metadata = { title: "Set new password — SHAI Proposal Generator" };

export default function ResetPasswordPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-foreground text-xl font-semibold tracking-tight">Set a new password</h1>
      <ResetPasswordForm />
    </div>
  );
}
