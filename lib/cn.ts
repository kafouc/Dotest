/**
 * Utilitaire pour combiner les classes Tailwind avec shadcn/ui
 * Compatible avec clsx et tailwind-merge
 */

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

