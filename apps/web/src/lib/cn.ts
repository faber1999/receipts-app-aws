export type ClassValue = string | false | null | undefined;

/** Joins class names, skipping falsy values. Later classes do not override earlier ones. */
export function cn(...classes: ClassValue[]): string {
  return classes.filter(Boolean).join(' ');
}
