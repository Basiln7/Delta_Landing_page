import { z } from "zod";
import { COURSE_CATEGORIES, ENQUIRY_STATUSES, PAYMENT_METHODS } from "@/lib/types";

export const PROGRAM_OPTIONS = [...COURSE_CATEGORIES, "Not sure yet"] as const;

export const enquirySchema = z.object({
  parentName: z.string().trim().min(2, "Please enter your full name").max(80),
  email: z.string().trim().email("Please enter a valid email address").max(120),
  phone: z.string().trim().max(40).optional().default(""),
  studentAge: z.string().trim().max(20).optional().default(""),
  program: z.enum(PROGRAM_OPTIONS, { message: "Please choose an area of interest" }),
  message: z.string().trim().max(1200).optional().default(""),
  // Honeypot — real users never fill this.
  website: z.string().max(0).optional(),
});

export type EnquiryInput = z.infer<typeof enquirySchema>;

export const enquiryUpdateSchema = z.object({
  status: z.enum(ENQUIRY_STATUSES as [string, ...string[]]).optional(),
  notes: z.string().max(4000).optional(),
});

export const checkoutSchema = z.object({
  customer: z.object({
    name: z.string().trim().min(2, "Please enter your full name").max(80),
    email: z.string().trim().email("Please enter a valid email address").max(120),
    phone: z.string().trim().min(7, "Please enter a phone number").max(30),
  }),
  items: z
    .array(z.object({ kind: z.enum(["course", "plan"]), id: z.string().min(1).max(60) }))
    .min(1, "Your cart is empty")
    .max(20),
  coupon: z.string().trim().max(30).optional(),
  paymentMethod: z.enum(PAYMENT_METHODS),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
