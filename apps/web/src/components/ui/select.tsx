import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { ChevronDownIcon } from '@/components/icons';
import { cn } from '@/lib/cn';
import { FieldError, FieldHint, fieldControlStyles, Label } from './input';

export interface SelectProps extends ComponentPropsWithoutRef<'select'> {
  /** Marks the field as invalid (sets aria-invalid and the error style). */
  invalid?: boolean;
  children: ReactNode;
}

/** Native select (keeps the platform picker on mobile) in the shared field chrome. */
export function Select({ invalid = false, className, children, ...props }: SelectProps) {
  return (
    <div className="relative">
      <select
        aria-invalid={invalid || undefined}
        className={cn(fieldControlStyles, 'appearance-none truncate pr-9', className)}
        {...props}
      >
        {children}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-ink-muted" />
    </div>
  );
}

export interface SelectFieldProps extends Omit<SelectProps, 'id' | 'invalid'> {
  /** Required: wires the label, hint and error to the select. */
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  /** Error message; when present the select is marked invalid. */
  error?: ReactNode;
  className?: string;
  selectClassName?: string;
}

/** Label + select + hint/error, with ids and aria attributes connected. */
export function SelectField({
  id,
  label,
  hint,
  error,
  className,
  selectClassName,
  children,
  'aria-describedby': describedBy,
  ...selectProps
}: SelectFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedByIds = [describedBy, hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={id}>{label}</Label>
      <Select
        id={id}
        invalid={Boolean(error)}
        aria-describedby={describedByIds}
        className={selectClassName}
        {...selectProps}
      >
        {children}
      </Select>
      {hint ? <FieldHint id={hintId}>{hint}</FieldHint> : null}
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
    </div>
  );
}
