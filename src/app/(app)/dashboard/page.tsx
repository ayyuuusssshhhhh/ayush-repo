import type { Metadata } from "next";
import { LayoutDashboard } from "lucide-react";
import { EmptyState } from "@/components/ui-custom/EmptyState";

export const metadata: Metadata = { title: "Dashboard — SHAI Proposal Generator" };

export default function DashboardPage() {
  return (
    <EmptyState
      icon={LayoutDashboard}
      title="Your dashboard is coming in Phase 2"
      description="Stats, recent proposals, and quick actions land here next. For now, you're signed in and your workspace is set up."
    />
  );
}
