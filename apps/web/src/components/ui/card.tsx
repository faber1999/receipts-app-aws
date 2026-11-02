import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface CardProps extends ComponentPropsWithoutRef<'div'> {
  children: ReactNode;
}

/** Raised surface. Do not nest cards; use dividers or muted regions inside instead. */
export function Card({ className, children, ...props }: CardProps) {
  return (
    <div className={cn('rounded-lg bg-surface text-ink shadow-md', className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }: CardProps) {
  return (
    <div className={cn('flex flex-col gap-1 px-6 pt-6', className)} {...props}>
      {children}
    </div>
  );
}

export interface CardTitleProps extends ComponentPropsWithoutRef<'h2'> {
  children: ReactNode;
}

export function CardTitle({ className, children, ...props }: CardTitleProps) {
  return (
    <h2 className={cn('text-lg font-semibold tracking-tight text-ink', className)} {...props}>
      {children}
    </h2>
  );
}

export interface CardDescriptionProps extends ComponentPropsWithoutRef<'p'> {
  children: ReactNode;
}

export function CardDescription({ className, children, ...props }: CardDescriptionProps) {
  return (
    <p className={cn('text-sm text-ink-muted', className)} {...props}>
      {children}
    </p>
  );
}

export function CardContent({ className, children, ...props }: CardProps) {
  return (
    <div className={cn('px-6 py-6', className)} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ className, children, ...props }: CardProps) {
  return (
    <div className={cn('flex items-center gap-3 border-t border-line px-6 py-4', className)} {...props}>
      {children}
    </div>
  );
}
