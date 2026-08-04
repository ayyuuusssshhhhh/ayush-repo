import { UserMenu } from "@/components/layout/UserMenu";

export function AppTopbar({ fullName, email }: { fullName: string; email: string }) {
  return (
    <header className="border-border flex h-14 shrink-0 items-center justify-between border-b px-4 md:px-6">
      <span className="text-foreground text-sm font-semibold tracking-tight md:hidden">
        SHAI Proposal Generator
      </span>
      <div className="ml-auto">
        <UserMenu fullName={fullName} email={email} />
      </div>
    </header>
  );
}
