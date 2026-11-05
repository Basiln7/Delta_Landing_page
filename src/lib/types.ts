// Shared domain types — used by the landing page, the admin panel and the API.

export type MediaType = "image" | "video" | "document";
export const MEDIA_COLLECTIONS = ["hero", "campus", "courses", "faculty", "events", "general"] as const;
export type MediaCollection = (typeof MEDIA_COLLECTIONS)[number];

export interface MediaItem {
  id: string;
  title: string;
  alt: string;
  url: string;
  type: MediaType;
  mime: string;
  size: number; // bytes (0 for remote)
  width?: number;
  height?: number;
  collection: MediaCollection;
  tags: string[];
  source: "upload" | "remote";
  createdAt: string;
  updatedAt: string;
}

export interface SiteSettings {
  name: string;
  shortName: string;
  tagline: string;
  intakeLabel: string;
  announcement: { enabled: boolean; text: string; linkLabel: string; href: string };
  hero: {
    eyebrow: string;
    headline: string; // words wrapped in *asterisks* render in italic brass
    subheadline: string;
    primaryCta: string;
    secondaryCta: string;
  };
  manifesto: string;
  contact: {
    email: string;
    phone: string;
    address: string;
    hours: string;
    /** WhatsApp number in international format, e.g. "+91 86069 24500". Empty hides the chat button. */
    whatsapp?: string;
    /** Message pre-filled when a visitor opens the WhatsApp chat. */
    whatsappMessage?: string;
  };
  socials: { label: string; href: string }[];
  /** Store currency — prices are stored as whole units of this currency. */
  currency: { code: string; symbol: string; locale: string };
  /** Trust badges shown in the hero, e.g. "KHDA approved academy". */
  badges: string[];
  /** Headline proof number ("10,000+ successful students"). */
  studentsCount: number;
  /** Launch-offer end (ISO). The countdown hides itself once this passes — no fake urgency. */
  offerEndsAt?: string;
  /** Link to the programme brochure (PDF upload or external URL). */
  brochureUrl?: string;
  /** Course id of the flagship programme. */
  flagshipCourseId: string;
  /** Shown in the footer and FAQ. Required for finance education. */
  riskDisclaimer: string;
}

export interface Stat {
  id: string;
  value: number;
  /** decimal places shown by the counter (e.g. 1 for "4.8") */
  decimals?: number;
  prefix?: string;
  suffix?: string;
  label: string;
  note?: string;
}

export interface Pillar {
  id: string;
  title: string;
  body: string;
  image: string;
  keywords: string[];
}

export const COURSE_CATEGORIES = ["Stock Market", "Trading", "Investing", "AI & Automation"] as const;
export type CourseCategory = (typeof COURSE_CATEGORIES)[number];
export const COURSE_LEVELS = ["Beginner", "Intermediate", "Advanced", "All levels"] as const;
export type CourseLevel = (typeof COURSE_LEVELS)[number];
export const COURSE_BADGES = ["", "Flagship", "Bestseller", "New", "Popular", "Limited seats"] as const;

export interface Course {
  id: string;
  title: string;
  subtitle: string;
  category: CourseCategory;
  level: CourseLevel;
  /** e.g. "Live + self-paced" */
  format: string;
  language: string;
  /** total video + live hours */
  hours: number;
  lessons: number;
  /** list price in store currency (whole units) */
  price: number;
  /** discounted price; 0 / undefined = no sale */
  salePrice?: number;
  rating: number;
  reviews: number;
  students: number;
  /** instructor display name — matches a faculty member's name */
  instructor: string;
  image: string;
  badge?: string;
  outcomes: string[];
  /** module titles, in order */
  curriculum: string[];
  certificate: boolean;
  featured: boolean;
  published: boolean;
}

export interface Plan {
  id: string;
  name: string;
  tagline: string;
  price: number;
  period: "month" | "year" | "one-time";
  features: string[];
  highlighted: boolean;
  cta: string;
  /** When set, the plan's button adds this course to the cart instead of a separate plan item. */
  courseId?: string;
}

/** Flagship curriculum module (module → topics). */
export interface ProgramModule {
  id: string;
  title: string;
  summary: string;
  topics: string[];
}

/** Capstone project learners finish the flagship with. */
export interface Project {
  id: string;
  title: string;
  summary: string;
  deliverable: string;
  tools: string[];
  image: string;
}

/** AI or market tool taught in the programme. */
export interface Tool {
  id: string;
  name: string;
  use: string;
  kind: "AI" | "Market" | "Automation" | "Data";
}

export interface Experience {
  id: string;
  title: string;
  category: string;
  body: string;
  image: string;
}

export interface FacultyMember {
  id: string;
  name: string;
  role: string;
  origin: string;
  bio: string;
  image: string;
}

export interface Testimonial {
  id: string;
  quote: string;
  author: string;
  role: string;
  origin: string;
  image: string;
}

export const EVENT_KINDS = ["New Batch", "Masterclass", "Webinar", "Workshop", "Open Day", "Info Session"] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

export interface EventItem {
  id: string;
  title: string;
  kind: EventKind;
  date: string; // ISO date
  time: string;
  location: string;
  image: string;
  published: boolean;
}

export interface Faq {
  id: string;
  question: string;
  answer: string;
}

export interface AdmissionStep {
  id: string;
  title: string;
  body: string;
  duration: string;
}

export type EnquiryStatus = "new" | "contacted" | "tour-booked" | "enrolled" | "archived";
export const ENQUIRY_STATUSES: EnquiryStatus[] = ["new", "contacted", "tour-booked", "enrolled", "archived"];

export interface Enquiry {
  id: string;
  parentName: string;
  email: string;
  phone: string;
  studentAge: string;
  program: string;
  message: string;
  status: EnquiryStatus;
  notes: string;
  createdAt: string;
}

export type OrderStatus = "paid" | "pending" | "refunded" | "failed";
export const ORDER_STATUSES: OrderStatus[] = ["paid", "pending", "refunded", "failed"];
export const PAYMENT_METHODS = ["upi", "card", "netbanking", "emi"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export type PaymentGateway = "demo" | "razorpay";

export interface OrderItem {
  kind: "course" | "plan";
  id: string;
  title: string;
  /** price charged for this line (after sale price, before coupon) */
  price: number;
}

export interface Order {
  id: string;
  /** human-friendly reference, e.g. DLT-10024 */
  number: string;
  customer: { name: string; email: string; phone: string };
  items: OrderItem[];
  subtotal: number;
  discount: number;
  total: number;
  coupon?: string;
  currency: string;
  /** method the learner picked (prefilled at checkout); the gateway may report a different one */
  paymentMethod: PaymentMethod;
  status: OrderStatus;
  createdAt: string;
  /** which processor took the payment (seeded/legacy orders: undefined = demo) */
  gateway?: PaymentGateway;
  /** Razorpay order id (order_…) */
  gatewayOrderId?: string;
  /** Razorpay payment id (pay_…) once a payment succeeds */
  gatewayPaymentId?: string;
  /** method as reported by the gateway (upi, card, netbanking, wallet, emi…) */
  gatewayMethod?: string;
  /** Razorpay refund id (rfnd_…) and its state */
  refundId?: string;
  refundStatus?: "pending" | "processed" | "failed";
  /** last failure reported by the gateway or checkout */
  failureReason?: string;
  paidAt?: string;
  updatedAt?: string;
  /** Email claims — set once per notification so verify + webhook never double-send. */
  notified?: { receipt?: string; staff?: string; refund?: string };
}

/** Webhook event ids already handled (idempotency). Capped list, newest first. */
export interface ProcessedEvent {
  id: string;
  event: string;
  receivedAt: string;
}

/* ───────────── Email (SMTP) — private, never part of public content ───────────── */

export type SmtpSecurity = "ssl" | "starttls" | "none";

export const MAIL_EVENTS = ["enquiry_staff", "enquiry_learner", "order_staff", "order_learner", "refund_learner"] as const;
export type MailEvent = (typeof MAIL_EVENTS)[number];

export interface MailSettings {
  enabled: boolean;
  host: string;
  port: number;
  security: SmtpSecurity;
  username: string;
  /** AES-256-GCM ciphertext ("v1:iv:tag:data"). Never sent to the browser. */
  passwordEnc?: string;
  fromName: string;
  fromEmail: string;
  replyTo?: string;
  /** Staff inboxes that receive enquiry / order notifications. */
  staffRecipients: string[];
  events: Record<MailEvent, boolean>;
  updatedAt?: string;
  verifiedAt?: string;
}

export interface MailLogEntry {
  id: string;
  at: string;
  event: MailEvent | "test";
  to: string;
  subject: string;
  status: "sent" | "failed" | "skipped";
  error?: string;
  messageId?: string;
  /** related record, e.g. order number or enquiry id */
  ref?: string;
}

/** Admin account security state (single admin). Private: never part of public content. */
export interface AdminSecurity {
  /** Bumped by "sign out everywhere" and by 2FA changes; sessions carrying an older value are rejected. */
  sessionVersion: number;
  totp?: {
    /** AES-256-GCM encrypted base32 secret (see lib/secrets) */
    secretEnc: string;
    enabledAt: string;
    /** last accepted time-step — codes at or before it are rejected (no replay) */
    lastStep?: number;
  };
  /** secret generated during setup, waiting for the first valid code */
  totpPending?: { secretEnc: string; createdAt: string };
  /** SHA-256 hashes of single-use recovery codes */
  recoveryCodes?: { hash: string; usedAt?: string }[];
  updatedAt?: string;
}

export interface Database {
  version: number;
  settings: SiteSettings;
  stats: Stat[];
  pillars: Pillar[];
  courses: Course[];
  plans: Plan[];
  modules: ProgramModule[];
  projects: Project[];
  tools: Tool[];
  experiences: Experience[];
  faculty: FacultyMember[];
  testimonials: Testimonial[];
  events: EventItem[];
  faqs: Faq[];
  admissions: AdmissionStep[];
  partners: string[];
  media: MediaItem[];
  enquiries: Enquiry[];
  orders: Order[];
  processedEvents?: ProcessedEvent[];
  mail?: MailSettings;
  mailLog?: MailLogEntry[];
  security?: AdminSecurity;
}

/** Collections editable through the generic admin collection editor. */
export const EDITABLE_COLLECTIONS = [
  "stats",
  "pillars",
  "courses",
  "plans",
  "modules",
  "projects",
  "tools",
  "experiences",
  "faculty",
  "testimonials",
  "events",
  "faqs",
  "admissions",
] as const;
export type EditableCollection = (typeof EDITABLE_COLLECTIONS)[number];

/** Everything the public landing page needs (no enquiries or orders). */
export type SiteContent = Omit<Database, "enquiries" | "orders" | "processedEvents" | "mail" | "mailLog" | "security" | "version">;
