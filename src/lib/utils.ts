import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a phone number with spaces for better readability
 * Input: +33622445802 or 33622445802 or 0622445802
 * Output: +33 6 22 44 58 02
 */
export function formatPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return "";
  
  // Remove all non-digit characters except +
  let cleaned = phone.replace(/[^\d+]/g, "");
  
  // Ensure it starts with +
  if (!cleaned.startsWith("+")) {
    // If starts with 0, assume French number
    if (cleaned.startsWith("0")) {
      cleaned = "+33" + cleaned.slice(1);
    } else if (cleaned.startsWith("33")) {
      cleaned = "+" + cleaned;
    } else {
      cleaned = "+" + cleaned;
    }
  }
  
  // Extract country code and rest
  const countryCodeMatch = cleaned.match(/^(\+\d{1,3})(\d+)$/);
  if (!countryCodeMatch) return cleaned;
  
  const countryCode = countryCodeMatch[1];
  const number = countryCodeMatch[2];
  
  // Format the rest in pairs
  const pairs = number.match(/.{1,2}/g) || [];
  
  return `${countryCode} ${pairs.join(" ")}`;
}

/**
 * Normalize a phone number for comparison (removes all spaces, dashes, etc.)
 */
export function normalizePhoneNumber(phone: string | null | undefined): string {
  if (!phone) return "";
  return phone.replace(/[\s\-\.\(\)]/g, "");
}
