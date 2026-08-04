import type { Metadata } from "next";
import { ProfileForm } from "@/features/settings/components/ProfileForm";
import { requireOrgContextForPage } from "@/lib/auth/context";

export const metadata: Metadata = { title: "Profile — SHAI Proposal Generator" };

export default async function ProfilePage() {
  const { user } = await requireOrgContextForPage();

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8">
      <h1 className="text-foreground text-xl font-semibold tracking-tight">Profile</h1>
      <ProfileForm fullName={user.fullName} email={user.email} />
    </div>
  );
}
