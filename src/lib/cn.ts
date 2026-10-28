import clsx, { type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Join class names and let later Tailwind utilities override earlier ones, so a
 * component's defaults (`px-3 py-1.5`) can be adjusted from the call site
 * (`py-[5px]`) without both landing in the markup.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
