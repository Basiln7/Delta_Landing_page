// Client-safe password rules, shared by the invite page, the change-password form and the API.

export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 128;

/** Passwords that have been public (docs, demo) or are top of every breach list. */
const BLOCKED = new Set([
  "delta-admin-2026",
  "password1234",
  "password12345",
  "123456789012",
  "qwertyuiop12",
  "adminadmin12",
  "letmein12345",
  "welcome12345",
  "changeme1234",
]);

/** Returns a reason the password is not acceptable, or null when it's fine. */
export function passwordProblem(password: string, ctx: { email?: string; name?: string } = {}): string | null {
  if (password.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters. A few random words work well.`;
  if (password.length > PASSWORD_MAX) return `Use at most ${PASSWORD_MAX} characters.`;
  const lower = password.toLowerCase();
  if (BLOCKED.has(lower)) return "That password is too common. Choose something else.";
  if (/^(.)\1+$/.test(password)) return "Don't repeat one character.";
  const local = ctx.email?.split("@")[0]?.toLowerCase();
  if ((ctx.email && lower === ctx.email.toLowerCase()) || (local && local.length >= 4 && lower.includes(local))) {
    return "Don't use your email address in your password.";
  }
  if (ctx.name && ctx.name.trim().length >= 4 && lower === ctx.name.trim().toLowerCase()) return "Don't use your name as your password.";
  return null;
}
