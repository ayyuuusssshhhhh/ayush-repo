import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { EmptyState } from "@/components/ui-custom/EmptyState";

export const metadata: Metadata = { title: "Proposals — SHAI Proposal Generator" };

export default function ProposalsPage() {
  return (
    <EmptyState
      icon={FileText}
      title="Proposal management is coming in Phase 3"
      description="Creating, searching, editing, and duplicating proposals lands here next."
    />
  );
}
