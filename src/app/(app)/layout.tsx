import { AppSidebar } from "@/components/layout/AppSidebar";
import { AppTopbar } from "@/components/layout/AppTopbar";
import { requireOrgContextForPage } from "@/lib/auth/context";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, organization } = await requireOrgContextForPage();

  return (
    <div className="flex min-h-full flex-1">
      <AppSidebar organizationName={organization.name} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppTopbar fullName={user.fullName} email={user.email} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
