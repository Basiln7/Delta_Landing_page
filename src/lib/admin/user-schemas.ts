import { z } from "zod";

/** Request bodies for user management, the invite page and self-service account changes. */

const name = z.string().trim().min(1, "Enter a name").max(80, "Keep it under 80 characters");
const role = z.enum(["super_admin", "admin"]);
/** optional fresh 2FA code for sensitive actions (step-up) */
const code = z.string().trim().max(20).optional();

export const userCreateSchema = z.object({
  name,
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(160),
  role,
  /** false = only return the link (don't email it) */
  sendEmail: z.boolean().optional(),
  code,
});

export const userPatchSchema = z
  .object({ name: name.optional(), role: role.optional(), disabled: z.boolean().optional(), code })
  .refine((v) => v.name !== undefined || v.role !== undefined || v.disabled !== undefined, "Nothing to change");

export const stepUpSchema = z.object({ code });

export const linkSchema = z.object({ sendEmail: z.boolean().optional() });

export const inviteTokenSchema = z.object({ token: z.string().max(100) });
export const acceptInviteSchema = z.object({ token: z.string().max(100), password: z.string().max(200) });

export const accountSchema = z.object({ name });
export const changePasswordSchema = z.object({ current: z.string().min(1, "Enter your current password").max(200), next: z.string().max(200) });
