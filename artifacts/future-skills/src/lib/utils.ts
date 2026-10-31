import { twMerge } from 'tailwind-merge';

import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDateDDMMYYYY(value: string): string {
  const isoDate = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
  if (isoDate) {
    const [, year, month, day] = isoDate;
    const parsed = new Date(0);
    parsed.setUTCFullYear(Number(year), Number(month) - 1, Number(day));
    parsed.setUTCHours(0, 0, 0, 0);

    if (
      parsed.getUTCFullYear() === Number(year) &&
      parsed.getUTCMonth() === Number(month) - 1 &&
      parsed.getUTCDate() === Number(day)
    ) {
      return `${day}/${month}/${year}`;
    }
    return value;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  const day = String(parsed.getUTCDate()).padStart(2, "0");
  const month = String(parsed.getUTCMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${parsed.getUTCFullYear()}`;
}
