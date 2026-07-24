import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export { APP_LOCALE } from "@/lib/format"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getStringColorIndex(str: string, maxColors: number): number {
  if (!str) return 0;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % maxColors;
}
