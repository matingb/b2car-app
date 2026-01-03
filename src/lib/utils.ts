import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export { APP_LOCALE } from "@/lib/format"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
