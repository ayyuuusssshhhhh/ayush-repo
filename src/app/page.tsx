import { Badge } from "@/components/ui/badge";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
      <Badge variant="secondary">Phase 0 — Foundation</Badge>
      <h1 className="text-foreground text-4xl font-semibold tracking-tight">
        SHAI Proposal Generator
      </h1>
      <p className="text-muted-foreground max-w-md text-lg text-balance">
        Turn RFPs, SOWs, and meeting notes into client-ready proposals in minutes.
      </p>
    </div>
  );
}
