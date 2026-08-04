import type { Metadata } from "next";
import { SignupForm } from "@/features/auth/components/SignupForm";
import { redirectIfAuthenticated } from "@/lib/auth/context";

export const metadata: Metadata = { title: "Sign up — SHAI Proposal Generator" };

export default async function SignupPage() {
  await redirectIfAuthenticated();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-foreground text-xl font-semibold tracking-tight">Create your account</h1>
      <SignupForm />
    </div>
  );
}
