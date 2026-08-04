import { updateProfileSchema } from "@/features/settings/schemas";
import { apiHandler, apiSuccess } from "@/lib/apiHandler";
import { requireOrgContext } from "@/lib/auth/context";
import { prisma } from "@/lib/prisma";

export const GET = apiHandler(async () => {
  const { user } = await requireOrgContext();
  return apiSuccess({ user });
});

export const PATCH = apiHandler(async (request) => {
  const { user } = await requireOrgContext();
  const body = updateProfileSchema.parse(await request.json());

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { fullName: body.fullName },
  });

  return apiSuccess({ user: updated });
});
