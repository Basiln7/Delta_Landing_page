import { z } from "zod";
import {
  COURSE_BADGES,
  COURSE_CATEGORIES,
  COURSE_LEVELS,
  EVENT_KINDS,
  MAIL_EVENTS,
  MEDIA_COLLECTIONS,
  ORDER_STATUSES,
  type EditableCollection,
} from "@/lib/types";

const text = (max = 200) => z.string().trim().min(1, "Required").max(max);
const optText = (max = 200) => z.string().trim().max(max).optional().default("");
const stringList = (max = 20) => z.array(z.string().trim().min(1).max(160)).max(max).default([]);
const image = z.string().trim().min(1, "Choose an image").max(1000);
const amount = z.coerce.number().min(0, "Must be 0 or more").max(10_000_000);
const count = z.coerce.number().int("Whole numbers only").min(0).max(100_000_000);

export const loginSchema = z.object({
  email: z.string().trim().min(3).max(200),
  password: z.string().min(1).max(200),
});

export const mediaPatchSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(160).optional(),
  alt: z.string().trim().max(300).optional(),
  collection: z.enum(MEDIA_COLLECTIONS).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
});

export const bulkDeleteSchema = z.object({ ids: z.array(z.string().min(1)).min(1).max(500) });

export const orderUpdateSchema = z.object({ status: z.enum(ORDER_STATUSES as [string, ...string[]]) });

/* ───────── Email (SMTP) ───────── */

const noLineBreaks = (v: string) => !/[\r\n]/.test(v);
const optionalEmail = z.union([z.literal(""), z.string().trim().email("Enter a valid email").max(254)]);

/** Body of PUT /api/admin/mail and the draft sent to /verify and /test. The password is write-only. */
export const mailSettingsSchema = z
  .object({
    enabled: z.boolean(),
    host: z
      .string()
      .trim()
      .max(253)
      .regex(/^[A-Za-z0-9.\-]*$|^\[[0-9A-Fa-f:.]+\]$/, "Use a host name like smtp.example.com"),
    port: z.coerce.number().int("Whole numbers only").min(1, "1–65535").max(65535, "1–65535"),
    security: z.enum(["ssl", "starttls", "none"]),
    username: z.string().trim().max(254).refine(noLineBreaks, "Invalid username"),
    /** present → replace the saved password; omitted → keep it */
    password: z.string().max(512).optional(),
    clearPassword: z.boolean().optional(),
    fromName: z.string().trim().max(80).refine(noLineBreaks, "Invalid name"),
    fromEmail: optionalEmail,
    replyTo: optionalEmail.optional().default(""),
    staffRecipients: z.array(z.string().trim().toLowerCase().email("Each recipient must be a valid email").max(254)).max(10, "Up to 10 recipients"),
    events: z.object(Object.fromEntries(MAIL_EVENTS.map((e) => [e, z.boolean()])) as Record<(typeof MAIL_EVENTS)[number], z.ZodBoolean>),
    /** PUT only: test the connection right after saving */
    verify: z.boolean().optional(),
  })
  .superRefine((v, ctx) => {
    if (!v.enabled) return;
    if (!v.host) ctx.addIssue({ code: "custom", path: ["host"], message: "Required to send email" });
    if (!v.fromEmail) ctx.addIssue({ code: "custom", path: ["fromEmail"], message: "Required to send email" });
  });

export type MailSettingsInput = z.infer<typeof mailSettingsSchema>;

export const mailTestSchema = z.object({
  to: z.string().trim().email("Enter a valid email").max(254),
  /** unsaved form values; omitted → use the saved settings */
  settings: mailSettingsSchema.optional(),
});

export const settingsSchema = z.object({
  name: text(120),
  shortName: text(40),
  tagline: text(160),
  intakeLabel: text(80),
  announcement: z.object({
    enabled: z.boolean(),
    text: z.string().trim().max(200),
    linkLabel: z.string().trim().max(60),
    href: z.string().trim().max(300),
  }),
  hero: z.object({
    eyebrow: optText(120),
    headline: text(160),
    subheadline: text(400),
    primaryCta: text(40),
    secondaryCta: text(40),
  }),
  manifesto: text(1200),
  contact: z.object({
    email: z.string().trim().email("Enter a valid email").max(160),
    phone: optText(60),
    address: optText(200),
    hours: optText(120),
    whatsapp: z
      .string()
      .trim()
      .max(30)
      .regex(/^$|^\+?[\d\s()-]{7,}$/, "Use international format, e.g. +91 86069 24500")
      .optional()
      .default(""),
    whatsappMessage: optText(300),
  }),
  socials: z
    .array(z.object({ label: text(40), href: z.string().trim().min(1, "Required").max(300) }))
    .max(12),
  currency: z.object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/, "3-letter ISO code, e.g. INR"),
    symbol: text(6),
    locale: z
      .string()
      .trim()
      .min(2)
      .max(20)
      .refine((l) => {
        try {
          return Intl.NumberFormat.supportedLocalesOf([l]).length > 0;
        } catch {
          return false;
        }
      }, "Unknown locale, e.g. en-IN"),
  }),
  badges: z
    .array(z.string().trim().max(80))
    .max(8)
    .default([])
    .transform((a) => a.filter(Boolean)),
  studentsCount: z.coerce.number().int().min(0).max(10_000_000),
  offerEndsAt: z
    .string()
    .trim()
    .max(40)
    .optional()
    .default("")
    .refine((v) => !v || !Number.isNaN(Date.parse(v)), "Use a valid date & time"),
  brochureUrl: optText(500),
  flagshipCourseId: text(60),
  riskDisclaimer: text(1200),
});

const courseSchema = z
  .object({
    title: text(120),
    subtitle: text(300),
    category: z.enum(COURSE_CATEGORIES),
    level: z.enum(COURSE_LEVELS),
    format: text(60),
    language: text(40),
    hours: z.coerce.number().min(0).max(5000),
    lessons: count,
    price: amount,
    salePrice: amount.optional().default(0),
    rating: z.coerce.number().min(0).max(5, "0–5"),
    reviews: count,
    students: count,
    instructor: text(80),
    image,
    badge: z.enum(COURSE_BADGES).optional().default(""),
    outcomes: stringList(),
    curriculum: stringList(40),
    certificate: z.boolean().default(true),
    featured: z.boolean().default(false),
    published: z.boolean().default(true),
  })
  .superRefine((c, ctx) => {
    if (c.salePrice && c.salePrice >= c.price) {
      ctx.addIssue({ code: "custom", path: ["salePrice"], message: "Sale price must be lower than the list price (or 0 for no sale)" });
    }
  });

export const collectionSchemas = {
  stats: z.object({
    value: z.coerce.number().min(0).max(1_000_000),
    decimals: z.coerce.number().int().min(0).max(3).optional().default(0),
    prefix: optText(8),
    suffix: optText(8),
    label: text(60),
    note: optText(120),
  }),
  pillars: z.object({ title: text(80), body: text(600), image, keywords: stringList() }),
  courses: courseSchema,
  plans: z.object({
    name: text(60),
    tagline: text(160),
    price: amount,
    period: z.enum(["month", "year", "one-time"]),
    features: stringList(),
    highlighted: z.boolean().default(false),
    cta: text(40),
    courseId: optText(60),
  }),
  modules: z.object({ title: text(100), summary: text(400), topics: stringList(20) }),
  projects: z.object({ title: text(100), summary: text(400), deliverable: text(200), tools: stringList(12), image }),
  tools: z.object({ name: text(60), use: text(200), kind: z.enum(["AI", "Market", "Automation", "Data"]) }),
  experiences: z.object({ title: text(80), category: z.enum(COURSE_CATEGORIES), body: text(400), image }),
  faculty: z.object({ name: text(80), role: text(80), origin: optText(80), bio: text(600), image }),
  testimonials: z.object({
    quote: text(600),
    author: text(80),
    role: text(80),
    origin: optText(60),
    image,
  }),
  events: z.object({
    title: text(120),
    kind: z.enum(EVENT_KINDS),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
    time: text(40),
    location: text(80),
    image,
    published: z.boolean().default(true),
  }),
  faqs: z.object({ question: text(200), answer: text(1500) }),
  admissions: z.object({ title: text(60), body: text(400), duration: text(40) }),
} satisfies Record<EditableCollection, z.ZodTypeAny>;

export const COLLECTION_PREFIX: Record<EditableCollection, string> = {
  stats: "st",
  pillars: "pl",
  courses: "c",
  plans: "plan",
  modules: "mod",
  projects: "pj",
  tools: "tl",
  experiences: "ex",
  faculty: "fc",
  testimonials: "ts",
  events: "ev",
  faqs: "fq",
  admissions: "ad",
};

export const reorderSchema = z.object({ order: z.array(z.string().min(1)).min(1) });

export function fieldErrors(error: z.ZodError) {
  return z.flattenError(error).fieldErrors;
}
