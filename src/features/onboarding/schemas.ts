import { z } from "zod";

export const onboardingSchema = z.object({
  fullName: z.string().min(1, "Enter your name.").max(120),
  companyName: z.string().min(1, "Enter your company name.").max(160),
});
export type OnboardingInput = z.infer<typeof onboardingSchema>;
