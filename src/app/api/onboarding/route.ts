import { onboardingSchema } from "@/features/onboarding/schemas";
import { apiHandler, apiSuccess } from "@/lib/apiHandler";
import { getSupabaseUser } from "@/lib/auth/context";
import { UnauthorizedError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

export const POST = apiHandler(async (request) => {
  const supabaseUser = await getSupabaseUser();
  if (!supabaseUser || !supabaseUser.email) {
    throw new UnauthorizedError();
  }

  const body = onboardingSchema.parse(await request.json());

  const existing = await prisma.user.findUnique({
    where: { id: supabaseUser.id },
    include: { organization: true },
  });
  if (existing) {
    // Idempotent: re-submitting onboarding just returns what's already there.
    return apiSuccess({ organization: existing.organization });
  }

  const organization = await prisma.organization.create({
    data: {
      name: body.companyName,
      users: {
        create: {
          id: supabaseUser.id,
          email: supabaseUser.email,
          fullName: body.fullName,
          // Whoever completes onboarding first creates the org — see plan §5.1.
          role: "ADMIN",
        },
      },
    },
  });

  return apiSuccess({ organization }, { status: 201 });
});
