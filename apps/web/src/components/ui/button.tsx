import Link from 'next/link';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonStyleOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Full width of the parent container. */
  block?: boolean;
  /** Disable the press scale (for dense or repeated controls). */
  static?: boolean;
}

const base =
  'relative inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap font-medium ' +
  'transition-[background-color,color,box-shadow,scale] duration-(--duration-quick) ease-standard ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ' +
  'disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-on-primary shadow-sm hover:bg-primary-hover',
  secondary: 'bg-surface text-ink shadow-sm ring-1 ring-line-strong ring-inset hover:bg-surface-muted',
  ghost: 'text-ink-muted hover:bg-surface-muted hover:text-ink',
};

const sizes: Record<ButtonSize, string> = {
  // The pseudo-element extends the hit area of the small size to 40px.
  sm: 'h-8 rounded-sm px-3 text-sm after:absolute after:inset-x-0 after:-inset-y-1 after:content-[""]',
  md: 'h-10 rounded-md px-4 text-sm',
  lg: 'h-12 rounded-md px-5 text-base',
};

export function buttonStyles({
  variant = 'primary',
  size = 'md',
  block = false,
  static: isStatic = false,
}: ButtonStyleOptions = {}): string {
  return cn(base, variants[variant], sizes[size], block && 'w-full', !isStatic && 'active:scale-(--scale-press)');
}

export interface ButtonProps extends ButtonStyleOptions, ComponentPropsWithoutRef<'button'> {
  children: ReactNode;
}

export function Button({
  variant,
  size,
  block,
  static: isStatic,
  className,
  type = 'button',
  children,
  ...props
}: ButtonProps) {
  return (
    <button type={type} className={cn(buttonStyles({ variant, size, block, static: isStatic }), className)} {...props}>
      {children}
    </button>
  );
}

export interface ButtonLinkProps extends ButtonStyleOptions, ComponentPropsWithoutRef<typeof Link> {
  children: ReactNode;
}

/** A Next.js link styled as a button, for navigation actions. */
export function ButtonLink({ variant, size, block, static: isStatic, className, children, ...props }: ButtonLinkProps) {
  return (
    <Link className={cn(buttonStyles({ variant, size, block, static: isStatic }), className)} {...props}>
      {children}
    </Link>
  );
}
