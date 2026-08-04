import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="flex w-full max-w-sm flex-col gap-8">
        <Link href="/" className="text-foreground text-center text-lg font-semibold tracking-tight">
          SHAI Proposal Generator
        </Link>
        <div className="border-border bg-card rounded-xl border p-8 shadow-sm">{children}</div>
      </div>
    </div>
  );
}
