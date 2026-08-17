import { z } from "zod";

import {
  CLIENT_STATUSES,
  INVOICE_STATUSES,
  PROJECT_STATUSES,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from "@/lib/constants";

/** Trim a form value and turn the empty string into undefined. */
const optionalText = z
  .string()
  .trim()
  .transform((value) => (value === "" ? undefined : value))
  .optional();

const optionalEmail = optionalText.refine(
  (value) => value === undefined || z.string().email().safeParse(value).success,
  { message: "Enter a valid email address" },
);

const optionalDate = z
  .string()
  .trim()
  .transform((value) => (value === "" ? undefined : value))
  .optional()
  .refine((value) => value === undefined || !Number.isNaN(Date.parse(value)), {
    message: "Enter a valid date",
  })
  .transform((value) => (value === undefined ? undefined : new Date(value)));

const moneyText = z
  .string()
  .trim()
  .transform((value) => (value === "" ? "0" : value))
  .refine((value) => Number.isFinite(Number(value.replace(/[^0-9.-]/g, ""))), {
    message: "Enter a valid amount",
  })
  .transform((value) => Math.round(Number(value.replace(/[^0-9.-]/g, "")) * 100))
  .refine((cents) => cents >= 0, { message: "Amount cannot be negative" });

export const loginSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const registerSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(120),
    email: z.string().trim().toLowerCase().email("Enter a valid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const clientSchema = z.object({
  name: z.string().trim().min(1, "Client name is required").max(160),
  company: optionalText,
  email: optionalEmail,
  phone: optionalText,
  website: optionalText,
  industry: optionalText,
  status: z.enum(CLIENT_STATUSES),
  addressLine: optionalText,
  city: optionalText,
  state: optionalText,
  postalCode: optionalText,
  country: optionalText,
  notes: optionalText,
  ownerId: optionalText,
});

export const contactSchema = z.object({
  clientId: z.string().min(1, "Client is required"),
  firstName: z.string().trim().min(1, "First name is required").max(80),
  lastName: z.string().trim().min(1, "Last name is required").max(80),
  email: optionalEmail,
  phone: optionalText,
  title: optionalText,
  isPrimary: z
    .union([z.literal("on"), z.literal("true"), z.literal(""), z.undefined()])
    .transform((value) => value === "on" || value === "true"),
});

export const projectSchema = z.object({
  clientId: z.string().min(1, "Client is required"),
  name: z.string().trim().min(1, "Project name is required").max(160),
  description: optionalText,
  status: z.enum(PROJECT_STATUSES),
  budget: moneyText,
  startDate: optionalDate,
  endDate: optionalDate,
});

export const taskSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  description: optionalText,
  status: z.enum(TASK_STATUSES),
  priority: z.enum(TASK_PRIORITIES),
  dueDate: optionalDate,
  clientId: optionalText,
  projectId: optionalText,
  assigneeId: optionalText,
});

export const invoiceItemSchema = z.object({
  description: z.string().trim().min(1, "Description is required").max(200),
  quantity: z
    .string()
    .trim()
    .transform((value) => (value === "" ? 1 : Number(value)))
    .refine((value) => Number.isFinite(value) && value > 0, { message: "Quantity must be above 0" }),
  unitPrice: moneyText,
});

export const invoiceSchema = z.object({
  clientId: z.string().min(1, "Client is required"),
  projectId: optionalText,
  number: z.string().trim().min(1, "Invoice number is required").max(40),
  status: z.enum(INVOICE_STATUSES),
  issueDate: optionalDate,
  dueDate: optionalDate,
  taxRate: z
    .string()
    .trim()
    .transform((value) => (value === "" ? 0 : Number(value)))
    .refine((value) => Number.isFinite(value) && value >= 0 && value <= 100, {
      message: "Tax rate must be between 0 and 100",
    }),
  notes: optionalText,
  items: z.array(invoiceItemSchema).min(1, "Add at least one line item"),
});

export const noteSchema = z.object({
  clientId: z.string().min(1),
  body: z.string().trim().min(1, "Note cannot be empty").max(5000),
});

/** Shape returned by every server action that backs a form. */
export type FormState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

export function toFieldErrors(error: z.ZodError): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    (result[key] ??= []).push(issue.message);
  }
  return result;
}
