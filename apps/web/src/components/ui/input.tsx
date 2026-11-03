import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface LabelProps extends ComponentPropsWithoutRef<'label'> {
  htmlFor: string;
  children: ReactNode;
}

export function Label({ htmlFor, className, children, ...props }: LabelProps) {
  return (
    <label htmlFor={htmlFor} className={cn('text-sm font-medium text-ink', className)} {...props}>
      {children}
    </label>
  );
}

export interface InputProps extends ComponentPropsWithoutRef<'input'> {
  /** Marks the field as invalid (sets aria-invalid and the error style). */
  invalid?: boolean;
}

export function Input({ invalid = false, className, ...props }: InputProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(
        'h-10 w-full rounded-md bg-surface px-3 text-base text-ink shadow-xs ring-1 ring-line-strong ring-inset sm:text-sm',
        'placeholder:text-ink-subtle',
        'transition-[box-shadow,background-color] duration-(--duration-quick) ease-standard',
        'hover:ring-ink-subtle',
        'focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus focus-visible:ring-transparent',
        // Invalid + focused keeps the danger ring and adds an offset danger outline,
        // so focus stays visibly distinct from the resting invalid state.
        'aria-invalid:ring-danger aria-invalid:focus-visible:outline-offset-2 aria-invalid:focus-visible:outline-danger aria-invalid:focus-visible:ring-danger',
        'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-60',
        className,
      )}
      {...props}
    />
  );
}

export interface FieldHintProps extends ComponentPropsWithoutRef<'p'> {
  children: ReactNode;
}

export function FieldHint({ className, children, ...props }: FieldHintProps) {
  return (
    <p className={cn('text-sm text-ink-muted', className)} {...props}>
      {children}
    </p>
  );
}

export interface FieldErrorProps extends ComponentPropsWithoutRef<'p'> {
  children: ReactNode;
}

export function FieldError({ className, children, ...props }: FieldErrorProps) {
  return (
    <p className={cn('flex items-start gap-1.5 text-sm text-danger', className)} {...props}>
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        className="mt-0.5 size-4 shrink-0"
      >
        <circle cx="8" cy="8" r="6.25" />
        <path d="M8 4.75v3.75M8 11.1v.15" />
      </svg>
      <span>{children}</span>
    </p>
  );
}

export interface TextFieldProps extends Omit<InputProps, 'id' | 'invalid'> {
  /** Required: wires the label, hint and error to the input. */
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  /** Error message; when present the input is marked invalid. */
  error?: ReactNode;
  className?: string;
  inputClassName?: string;
}

/** Label + input + hint/error, with ids and aria attributes connected. */
export function TextField({
  id,
  label,
  hint,
  error,
  className,
  inputClassName,
  'aria-describedby': describedBy,
  ...inputProps
}: TextFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedByIds = [describedBy, hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        invalid={Boolean(error)}
        aria-describedby={describedByIds}
        className={inputClassName}
        {...inputProps}
      />
      {hint ? <FieldHint id={hintId}>{hint}</FieldHint> : null}
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
    </div>
  );
}
