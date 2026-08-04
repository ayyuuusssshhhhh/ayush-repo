import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { UnauthorizedError } from "@/lib/errors";
import type { Organization, User } from "@/generated/prisma/client";

/** The Supabase auth user for the current request, or null if unauthenticated. Memoized per-request. */
export const getSupabaseUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/** The Prisma User (with its Organization) matching the current Supabase session, or null. */
export const getOrgContext = cache(
  async (): Promise<{ user: User; organization: Organization } | null> => {
    const supabaseUser = await getSupabaseUser();
    if (!supabaseUser) return null;

    const user = await prisma.user.findUnique({
      where: { id: supabaseUser.id },
      include: { organization: true },
    });
    if (!user) return null;

    const { organization, ...rest } = user;
    return { user: rest as User, organization };
  },
);

/** For Route Handlers: throws UnauthorizedError instead of redirecting. */
export async function requireOrgContext() {
  const context = await getOrgContext();
  if (!context) {
    throw new UnauthorizedError();
  }
  return context;
}

/** For Server Component pages under the authenticated app shell. */
export async function requireOrgContextForPage() {
  const supabaseUser = await getSupabaseUser();
  if (!supabaseUser) {
    redirect("/login");
  }

  const context = await getOrgContext();
  if (!context) {
    redirect("/onboarding");
  }

  return context;
}

/** For /login, /signup, etc. — sends already-signed-in users where they belong instead of showing the form. */
export async function redirectIfAuthenticated() {
  const supabaseUser = await getSupabaseUser();
  if (!supabaseUser) return;

  const context = await getOrgContext();
  redirect(context ? "/dashboard" : "/onboarding");
}
