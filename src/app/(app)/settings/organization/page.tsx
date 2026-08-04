import type { Metadata } from "next";
import { requireOrgContextForPage } from "@/lib/auth/context";

export const metadata: Metadata = { title: "Organization — SHAI Proposal Generator" };

export default async function OrganizationSettingsPage() {
  const { organization } = await requireOrgContextForPage();

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8">
      <h1 className="text-foreground text-xl font-semibold tracking-tight">Organization</h1>
      <div className="flex max-w-md flex-col gap-2">
        <span className="text-muted-foreground text-sm font-medium">Name</span>
        <p className="text-foreground text-sm">{organization.name}</p>
      </div>
      <p className="text-muted-foreground text-sm">
        Team management is coming in a future release. For now, everyone who signs up shares this
        workspace and its proposals.
      </p>
    </div>
  );
}
