import { z } from "zod";

export const updateProfileSchema = z.object({
  fullName: z.string().min(1, "Enter your name.").max(120),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
