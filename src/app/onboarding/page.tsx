import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingForm } from "@/features/onboarding/components/OnboardingForm";
import { getOrgContext, getSupabaseUser } from "@/lib/auth/context";

export const metadata: Metadata = { title: "Set up your workspace — SHAI Proposal Generator" };

export default async function OnboardingPage() {
  const supabaseUser = await getSupabaseUser();
  if (!supabaseUser) {
    redirect("/login");
  }

  const context = await getOrgContext();
  if (context) {
    redirect("/dashboard");
  }

  const defaultFullName =
    typeof supabaseUser.user_metadata?.full_name === "string"
      ? supabaseUser.user_metadata.full_name
      : undefined;

  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="flex w-full max-w-sm flex-col gap-8">
        <div className="text-center">
          <h1 className="text-foreground text-lg font-semibold tracking-tight">
            Set up your workspace
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            This creates the shared workspace your whole team will use.
          </p>
        </div>
        <div className="border-border bg-card rounded-xl border p-8 shadow-sm">
          <OnboardingForm defaultFullName={defaultFullName} />
        </div>
      </div>
    </div>
  );
}
