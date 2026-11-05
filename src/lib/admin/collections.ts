import { coursePrice, formatPrice, planPeriodLabel, type Currency } from "@/lib/commerce";
import { COURSE_BADGES, COURSE_CATEGORIES, COURSE_LEVELS, EVENT_KINDS, type EditableCollection } from "@/lib/types";

/** Schema-driven config for the generic CollectionEditor (client-safe). */
export type FieldType = "text" | "textarea" | "number" | "date" | "boolean" | "select" | "list" | "image";

export type FieldOption = string | { value: string; label: string };

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  options?: readonly FieldOption[];
  /** Options resolved at runtime from other content (e.g. instructor names). */
  optionsFrom?: "faculty";
  placeholder?: string;
  hint?: string;
  required?: boolean;
  half?: boolean;
  step?: number;
  /** Renders a small section heading before this field. */
  section?: string;
}

/** Runtime context passed from the Content page (other collections + store settings). */
export interface EditorContext {
  currency: Currency;
  facultyNames: string[];
}

export interface CollectionConfig {
  key: EditableCollection;
  label: string;
  singular: string;
  description: string;
  titleKey: string;
  subtitle: (item: Record<string, unknown>, ctx: EditorContext) => string;
  imageKey?: string;
  fields: FieldDef[];
}

const s = (v: unknown) => (v == null ? "" : String(v));
const n = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);

/** Content the v4 finance landing page no longer renders — hidden so editors aren't confused (data is kept). */
const HIDDEN_ON_SITE: EditableCollection[] = ["pillars", "experiences", "admissions"];

const ALL_COLLECTIONS: CollectionConfig[] = [
  {
    key: "courses",
    label: "Courses",
    singular: "course",
    description: "The catalogue learners browse and buy. Drafts stay hidden from the store.",
    titleKey: "title",
    subtitle: (i, ctx) =>
      [
        formatPrice(coursePrice({ price: n(i.price), salePrice: n(i.salePrice) }), ctx.currency) +
          (n(i.salePrice) > 0 && n(i.salePrice) < n(i.price) ? ` (was ${formatPrice(n(i.price), ctx.currency)})` : ""),
        s(i.category),
        s(i.level),
        i.published === false ? "Draft" : "",
      ]
        .filter(Boolean)
        .join(" · "),
    imageKey: "image",
    fields: [
      { key: "title", label: "Title", type: "text", required: true, section: "Basics" },
      { key: "subtitle", label: "Subtitle", type: "textarea", required: true, hint: "One or two sentences shown on the course card." },
      { key: "category", label: "Category", type: "select", options: COURSE_CATEGORIES, required: true, half: true },
      { key: "level", label: "Level", type: "select", options: COURSE_LEVELS, required: true, half: true },
      { key: "format", label: "Format", type: "text", required: true, half: true, placeholder: "Live + self-paced" },
      { key: "language", label: "Language", type: "text", required: true, half: true, placeholder: "English" },
      { key: "hours", label: "Total hours", type: "number", required: true, half: true, step: 0.5 },
      { key: "lessons", label: "Lessons", type: "number", required: true, half: true },
      { key: "instructor", label: "Mentor", type: "select", optionsFrom: "faculty", required: true, hint: "Manage the list under Mentors." },
      { key: "image", label: "Cover image", type: "image", required: true },

      { key: "price", label: "List price", type: "number", required: true, half: true, section: "Pricing", hint: "Whole units of the store currency." },
      { key: "salePrice", label: "Sale price", type: "number", half: true, hint: "0 = no sale." },
      { key: "badge", label: "Badge", type: "select", options: COURSE_BADGES.map((b) => ({ value: b, label: b || "None" })), half: true },

      { key: "rating", label: "Rating", type: "number", half: true, step: 0.1, section: "Social proof", hint: "0 – 5" },
      { key: "reviews", label: "Reviews", type: "number", half: true },
      { key: "students", label: "Students", type: "number", half: true },

      { key: "outcomes", label: "What you'll learn", type: "list", section: "Content", hint: "Press Enter after each outcome." },
      { key: "curriculum", label: "Curriculum modules", type: "list", hint: "Module titles, in order." },

      { key: "published", label: "Published", type: "boolean", section: "Visibility", hint: "Drafts are hidden from the store and can't be bought." },
      { key: "featured", label: "Featured", type: "boolean", hint: "Highlighted at the top of the catalogue." },
      { key: "certificate", label: "Certificate of completion", type: "boolean", hint: "Shows the certificate badge on the course." },
    ],
  },
  {
    key: "plans",
    label: "Plans",
    singular: "plan",
    description: "Memberships shown in the pricing section.",
    titleKey: "name",
    subtitle: (i, ctx) => `${formatPrice(n(i.price), ctx.currency)} ${planPeriodLabel((s(i.period) || "month") as "month")} · ${s(i.tagline)}`,
    fields: [
      { key: "name", label: "Name", type: "text", required: true, half: true },
      { key: "cta", label: "Button label", type: "text", required: true, half: true, placeholder: "Get Delta Pass" },
      { key: "tagline", label: "Tagline", type: "text", required: true },
      { key: "price", label: "Price", type: "number", required: true, half: true, hint: "Whole units of the store currency." },
      {
        key: "period",
        label: "Billing period",
        type: "select",
        required: true,
        half: true,
        options: [
          { value: "month", label: "Monthly" },
          { value: "year", label: "Yearly" },
          { value: "one-time", label: "One-time" },
        ],
      },
      { key: "features", label: "Features", type: "list", hint: "Press Enter after each feature." },
      { key: "highlighted", label: "Highlight this plan", type: "boolean", hint: "Shown as the recommended plan." },
      { key: "courseId", label: "Sells a course (course id)", type: "text", placeholder: "c_flagship", hint: "Optional. When set, the button adds that course to the cart (e.g. the flagship) instead of a separate plan." },
    ],
  },
  {
    key: "modules",
    label: "Curriculum",
    singular: "module",
    description: "The flagship programme, module by module. Drag to reorder.",
    titleKey: "title",
    subtitle: (i) => `${Array.isArray(i.topics) ? i.topics.length : 0} topics · ${s(i.summary).slice(0, 70)}`,
    fields: [
      { key: "title", label: "Module title", type: "text", required: true },
      { key: "summary", label: "Summary", type: "textarea", required: true },
      { key: "topics", label: "Topics", type: "list", hint: "Press Enter after each topic, in teaching order." },
    ],
  },
  {
    key: "projects",
    label: "Projects",
    singular: "project",
    description: "What learners build and keep by the end of the flagship.",
    titleKey: "title",
    subtitle: (i) => s(i.deliverable),
    imageKey: "image",
    fields: [
      { key: "title", label: "Project title", type: "text", required: true },
      { key: "summary", label: "Summary", type: "textarea", required: true },
      { key: "deliverable", label: "Deliverable", type: "text", required: true, placeholder: "A 12-page research report on a stock of your choice" },
      { key: "tools", label: "Tools used", type: "list" },
      { key: "image", label: "Image", type: "image", required: true },
    ],
  },
  {
    key: "tools",
    label: "Tools",
    singular: "tool",
    description: "AI and market tools taught in the programme (shown as the tools strip).",
    titleKey: "name",
    subtitle: (i) => `${s(i.kind)} · ${s(i.use)}`,
    fields: [
      { key: "name", label: "Tool", type: "text", required: true, half: true },
      { key: "kind", label: "Type", type: "select", options: ["AI", "Market", "Automation", "Data"], required: true, half: true },
      { key: "use", label: "What learners use it for", type: "text", required: true },
    ],
  },
  {
    key: "experiences",
    label: "Learning paths",
    singular: "learning path",
    description: "Goal-based entry points. Each one filters the catalogue by its category.",
    titleKey: "title",
    subtitle: (i) => s(i.category),
    imageKey: "image",
    fields: [
      { key: "title", label: "Title", type: "text", required: true },
      { key: "category", label: "Catalogue category", type: "select", options: COURSE_CATEGORIES, required: true, hint: "Clicking the path filters the catalogue to this category." },
      { key: "body", label: "Description", type: "textarea", required: true },
      { key: "image", label: "Image", type: "image", required: true },
    ],
  },
  {
    key: "faculty",
    label: "Mentors",
    singular: "mentor",
    description: "Instructors featured on the site. Courses link to them by name.",
    titleKey: "name",
    subtitle: (i) => [s(i.role), s(i.origin)].filter(Boolean).join(" · "),
    imageKey: "image",
    fields: [
      { key: "name", label: "Full name", type: "text", required: true, hint: "Renaming? Update the instructor on their courses too." },
      { key: "role", label: "Role", type: "text", required: true, half: true },
      { key: "origin", label: "Origin", type: "text", half: true, placeholder: "Germany" },
      { key: "bio", label: "Bio", type: "textarea", required: true },
      { key: "image", label: "Portrait", type: "image", required: true },
    ],
  },
  {
    key: "events",
    label: "Seminars & batches",
    singular: "batch or webinar",
    description: "New batches, masterclasses and webinars. Only published, upcoming items appear on the site.",
    titleKey: "title",
    subtitle: (i) => [s(i.kind), s(i.date), s(i.location), i.published === false ? "Draft" : ""].filter(Boolean).join(" · "),
    imageKey: "image",
    fields: [
      { key: "title", label: "Title", type: "text", required: true },
      { key: "kind", label: "Type", type: "select", options: EVENT_KINDS, required: true, half: true },
      { key: "date", label: "Date", type: "date", required: true, half: true },
      { key: "time", label: "Time", type: "text", required: true, half: true, placeholder: "18:00 – 19:00 IST" },
      { key: "location", label: "Location", type: "text", required: true, half: true, placeholder: "Live online" },
      { key: "image", label: "Image", type: "image", required: true },
      { key: "published", label: "Published", type: "boolean", hint: "Drafts stay hidden from the website." },
    ],
  },
  {
    key: "testimonials",
    label: "Learner stories",
    singular: "story",
    description: "Reviews and outcomes from learners.",
    titleKey: "author",
    subtitle: (i) => [s(i.role), s(i.origin)].filter(Boolean).join(" · "),
    imageKey: "image",
    fields: [
      { key: "quote", label: "Quote", type: "textarea", required: true },
      { key: "author", label: "Name", type: "text", required: true, half: true },
      { key: "role", label: "Role / result", type: "text", required: true, half: true, placeholder: "IELTS Band 8 · Nurse in the UK" },
      { key: "origin", label: "Country", type: "text", half: true },
      { key: "image", label: "Photo", type: "image", required: true },
    ],
  },
  {
    key: "pillars",
    label: "Why Delta",
    singular: "reason",
    description: "The reasons to learn with Delta, shown as stacking cards.",
    titleKey: "title",
    subtitle: (i) => (Array.isArray(i.keywords) ? (i.keywords as string[]).join(" · ") : ""),
    imageKey: "image",
    fields: [
      { key: "title", label: "Title", type: "text", required: true },
      { key: "body", label: "Body", type: "textarea", required: true },
      { key: "keywords", label: "Keywords", type: "list" },
      { key: "image", label: "Image", type: "image", required: true },
    ],
  },
  {
    key: "stats",
    label: "Stats",
    singular: "stat",
    description: "The proof-in-numbers counters.",
    titleKey: "label",
    subtitle: (i) => `${s(i.prefix)}${n(i.value).toFixed(n(i.decimals))}${s(i.suffix)}${i.note ? ` — ${s(i.note)}` : ""}`,
    fields: [
      { key: "label", label: "Label", type: "text", required: true },
      { key: "value", label: "Value", type: "number", required: true, half: true, step: 0.1 },
      { key: "decimals", label: "Decimal places", type: "number", half: true, hint: "e.g. 1 for 4.8" },
      { key: "prefix", label: "Prefix", type: "text", half: true, placeholder: "1:" },
      { key: "suffix", label: "Suffix", type: "text", half: true, placeholder: "+" },
      { key: "note", label: "Note", type: "text" },
    ],
  },
  {
    key: "admissions",
    label: "How it works",
    singular: "step",
    description: "The steps from first visit to first class.",
    titleKey: "title",
    subtitle: (i) => s(i.duration),
    fields: [
      { key: "title", label: "Title", type: "text", required: true, half: true },
      { key: "duration", label: "Timing", type: "text", required: true, half: true, placeholder: "Day 1" },
      { key: "body", label: "Description", type: "textarea", required: true },
    ],
  },
  {
    key: "faqs",
    label: "FAQs",
    singular: "question",
    description: "Frequently asked questions.",
    titleKey: "question",
    subtitle: (i) => s(i.answer).slice(0, 90) + (s(i.answer).length > 90 ? "…" : ""),
    fields: [
      { key: "question", label: "Question", type: "text", required: true },
      { key: "answer", label: "Answer", type: "textarea", required: true },
    ],
  },
];

const DEFAULTS: Partial<Record<EditableCollection, Record<string, unknown>>> = {
  courses: { language: "English", format: "Live + self-paced", certificate: true, featured: false, published: false, badge: "", salePrice: 0, rating: 0, reviews: 0, students: 0 },
  plans: { period: "month", highlighted: false },
  events: { published: true },
  stats: { decimals: 0 },
};

export function emptyItem(config: CollectionConfig): Record<string, unknown> {
  const base = Object.fromEntries(
    config.fields.map((f) => [f.key, f.type === "list" ? [] : f.type === "boolean" ? true : f.type === "number" ? "" : ""]),
  );
  return { ...base, ...DEFAULTS[config.key] };
}

export function optionValue(o: FieldOption) {
  return typeof o === "string" ? o : o.value;
}
export function optionLabel(o: FieldOption) {
  return typeof o === "string" ? o : o.label;
}

export const COLLECTIONS: CollectionConfig[] = ALL_COLLECTIONS.filter((c) => !HIDDEN_ON_SITE.includes(c.key));
