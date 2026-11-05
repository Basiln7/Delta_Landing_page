import type { MediaCollection, MediaType, OrderStatus, PaymentMethod } from "@/lib/types";

export const COLLECTION_META: Record<MediaCollection, { label: string; description: string }> = {
  hero: { label: "Hero", description: "Homepage hero image — the newest image here is used." },
  campus: { label: "Gallery", description: "Shown in the homepage photo gallery." },
  courses: { label: "Courses", description: "Course cover images — pick them in Content → Courses." },
  faculty: { label: "Instructors", description: "Instructor portraits — pick them in Content → Instructors." },
  events: { label: "Batches & events", description: "Imagery for batches and webinars — pick it in Content." },
  general: { label: "General", description: "Unsorted library items." },
};

export const TYPE_META: Record<MediaType | "all", string> = {
  all: "All",
  image: "Images",
  video: "Videos",
  document: "Docs",
};

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  upi: "UPI",
  card: "Card",
  netbanking: "Net banking",
  emi: "No-cost EMI",
};

export const ORDER_STATUS_META: Record<OrderStatus, { label: string; tone: "green" | "brass" | "muted" | "pin"; dot: string }> = {
  paid: { label: "Paid", tone: "green", dot: "bg-emerald-600" },
  pending: { label: "Pending", tone: "brass", dot: "bg-brass" },
  refunded: { label: "Refunded", tone: "muted", dot: "bg-ink/30" },
  failed: { label: "Failed", tone: "pin", dot: "bg-pin" },
};
