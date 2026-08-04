import { redirect } from "next/navigation";
import { getOrgContext, getSupabaseUser } from "@/lib/auth/context";

export default async function Home() {
  const supabaseUser = await getSupabaseUser();
  if (!supabaseUser) {
    redirect("/login");
  }

  const context = await getOrgContext();
  redirect(context ? "/dashboard" : "/onboarding");
}
