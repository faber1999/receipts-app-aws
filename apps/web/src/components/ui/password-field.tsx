'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { useI18n } from '@/i18n/i18n-provider';
import { cn } from '@/lib/cn';
import { FieldError, FieldHint, Input, Label, type TextFieldProps } from './input';
import { Tooltip } from './tooltip';

export type PasswordFieldProps = Omit<TextFieldProps, 'type'>;

interface SelectionRange {
  start: number;
  end: number;
}

// Icon swap (transitions.dev recipe): both icons share one grid cell and cross-fade
// with blur + scale. Reduced motion collapses the transition via the global rule.
const iconClasses = cn(
  'col-start-1 row-start-1 size-4',
  'transition-[opacity,filter,scale] duration-(--icon-swap-dur) ease-(--icon-swap-ease)',
);
const iconHidden = 'scale-(--icon-swap-start-scale) opacity-0 blur-(--icon-swap-blur)';

/**
 * Password input with a show/hide toggle. Same API as TextField, minus `type`.
 * Toggling only swaps the input type, so `name` and `autoComplete` stay intact
 * for password managers. Focus stays on the toggle; the caret/selection of the
 * input is restored so returning to it continues where the user left off.
 */
export function PasswordField({
  id,
  label,
  hint,
  error,
  className,
  inputClassName,
  'aria-describedby': describedBy,
  ...inputProps
}: PasswordFieldProps) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  const selection = useRef<SelectionRange | null>(null);

  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedByIds = [describedBy, hintId, errorId].filter(Boolean).join(' ') || undefined;
  const toggleLabel = visible ? t.passwordVisibility.hide : t.passwordVisibility.show;

  function getInput(): HTMLInputElement | null {
    const element = document.getElementById(id);
    return element instanceof HTMLInputElement ? element : null;
  }

  function handleToggle(): void {
    const input = getInput();
    if (input && input.selectionStart !== null && input.selectionEnd !== null) {
      selection.current = { start: input.selectionStart, end: input.selectionEnd };
    }
    setVisible((current) => !current);
  }

  // Some engines reset the selection when an input's type changes; put it back.
  // setSelectionRange does not move focus, so the toggle keeps it.
  useLayoutEffect(() => {
    const saved = selection.current;
    if (!saved) return;
    selection.current = null;
    getInput()?.setSelectionRange(saved.start, saved.end);
  });

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          invalid={Boolean(error)}
          aria-describedby={describedByIds}
          className={cn('pr-10', inputClassName)}
          {...inputProps}
          type={visible ? 'text' : 'password'}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
        <div className="absolute top-1 right-1 flex">
          <Tooltip content={toggleLabel} describe={false} align="end">
            <button
              type="button"
              aria-label={toggleLabel}
              aria-controls={id}
              onClick={handleToggle}
              className={cn(
                // Visual: 32px chip, concentric with the input (10px - 4px inset = 6px).
                // Hit area: the pseudo-element extends it to the full 40px input height.
                'relative grid size-8 place-items-center rounded-sm text-ink-muted',
                'before:absolute before:-inset-1 before:content-[""]',
                'transition-[color,background-color] duration-(--duration-quick) ease-standard',
                'hover:bg-surface-muted hover:text-ink',
                'focus-visible:outline-offset-0',
              )}
            >
              <span className="grid">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.75}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={cn(iconClasses, visible && iconHidden)}
                >
                  <path d="M1.75 8S4 3.75 8 3.75 14.25 8 14.25 8 12 12.25 8 12.25 1.75 8 1.75 8Z" />
                  <circle cx="8" cy="8" r="2" />
                </svg>
                <svg
                  aria-hidden="true"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.75}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={cn(iconClasses, !visible && iconHidden)}
                >
                  <path d="M6.6 3.9A6.4 6.4 0 0 1 8 3.75c4 0 6.25 4.25 6.25 4.25a11 11 0 0 1-1.6 2.15" />
                  <path d="M9.42 9.42a2 2 0 0 1-2.84-2.84" />
                  <path d="M11.55 11.6A6.6 6.6 0 0 1 8 12.25C4 12.25 1.75 8 1.75 8a11.3 11.3 0 0 1 2.7-3.3" />
                  <path d="m2.25 2.25 11.5 11.5" />
                </svg>
              </span>
            </button>
          </Tooltip>
        </div>
      </div>
      {hint ? <FieldHint id={hintId}>{hint}</FieldHint> : null}
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
    </div>
  );
}
