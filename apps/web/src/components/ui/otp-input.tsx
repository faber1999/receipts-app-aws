'use client';

import {
  type ClipboardEvent,
  type ComponentPropsWithoutRef,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type SyntheticEvent,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { cn } from '@/lib/cn';
import { FieldError, FieldHint, Label } from './input';

type NativeInputProps = Omit<
  ComponentPropsWithoutRef<'input'>,
  'value' | 'defaultValue' | 'onChange' | 'maxLength' | 'minLength' | 'type' | 'size' | 'children'
>;

export interface OtpInputProps extends NativeInputProps {
  /** Number of digits (default 6). Also sets the input's maxLength. */
  length?: number;
  /** Controlled value (digits only). Pair with onValueChange. */
  value?: string;
  /** Initial value when uncontrolled. */
  defaultValue?: string;
  /** Called with the sanitized digits on every change. */
  onValueChange?: (value: string) => void;
  /** Called once each time the code reaches `length` digits. Never submits on its own. */
  onComplete?: (code: string) => void;
  /** Marks the field as invalid (sets aria-invalid, the danger ring and a single shake). */
  invalid?: boolean;
  /** Classes for the slot row wrapper (the clickable area). */
  containerClassName?: string;
}

interface Selection {
  start: number;
  end: number;
}

function onlyDigits(text: string, length: number): string {
  return text.replace(/\D/g, '').slice(0, length);
}

function getSelection(input: HTMLInputElement): Selection {
  const start = input.selectionStart ?? input.value.length;
  return { start, end: input.selectionEnd ?? start };
}

/** Keeps the previous object when nothing moved, so React can skip the render. */
function sameSelection(current: Selection, next: Selection): Selection {
  return current.start === next.start && current.end === next.end ? current : next;
}

/** Index of the first character that differs between two strings. */
function firstDiff(previous: string, next: string): number {
  let index = 0;
  while (index < previous.length && index < next.length && previous[index] === next[index]) {
    index += 1;
  }
  return index;
}

/**
 * One-time code input. A single real <input> sits transparent over the visual
 * slots, so paste, autofill, one-time-code suggestions, mobile keypads, FormData
 * and screen readers all see one native field.
 */
export function OtpInput({
  length = 6,
  value: valueProp,
  defaultValue = '',
  onValueChange,
  onComplete,
  invalid = false,
  disabled,
  className,
  containerClassName,
  onFocus,
  onBlur,
  onSelect,
  onKeyDown,
  onPaste,
  onClick,
  ...inputProps
}: OtpInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [internalValue, setInternalValue] = useState(() => onlyDigits(defaultValue, length));
  const value = onlyDigits(valueProp ?? internalValue, length);
  const [focused, setFocused] = useState(false);
  const [selection, setSelection] = useState<Selection>({ start: value.length, end: value.length });
  // First slot changed by the last user edit; a multi-digit paste pops from here.
  const [popFrom, setPopFrom] = useState(0);
  const [shaking, setShaking] = useState(false);
  const [wasInvalid, setWasInvalid] = useState(invalid);

  // Shake once on the transition into the invalid state (derived during render).
  if (invalid !== wasInvalid) {
    setWasInvalid(invalid);
    setShaking(invalid);
  }

  function readSelection(input: HTMLInputElement): void {
    setSelection((current) => sameSelection(current, getSelection(input)));
  }

  // Programmatic value changes (paste, controlled updates) don't fire `select`.
  useLayoutEffect(() => {
    const input = inputRef.current;
    if (input && input.value === value) {
      setSelection((current) => sameSelection(current, getSelection(input)));
    }
  }, [value]);

  function commit(next: string): void {
    if (next === value) {
      return;
    }
    setPopFrom(firstDiff(value, next));
    if (valueProp === undefined) {
      setInternalValue(next);
    }
    onValueChange?.(next);
    if (next.length === length && value.length < length) {
      onComplete?.(next);
    }
  }

  function handleSelect(event: SyntheticEvent<HTMLInputElement>): void {
    const input = event.currentTarget;
    // A collapsed caret on a filled slot selects that digit, so typing replaces it.
    if (input.selectionStart !== null && input.selectionStart === input.selectionEnd) {
      const caret = input.selectionStart;
      if (caret < input.value.length) {
        input.setSelectionRange(caret, caret + 1);
      }
    }
    readSelection(input);
    onSelect?.(event);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    onKeyDown?.(event);
    if (event.defaultPrevented) {
      return;
    }
    const input = event.currentTarget;
    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? start;
    // With a digit selected, native ArrowLeft would collapse onto the same slot.
    if (event.key === 'ArrowLeft' && !event.shiftKey && !event.metaKey && end - start === 1) {
      event.preventDefault();
      const previous = Math.max(0, start - 1);
      input.setSelectionRange(previous, previous + 1);
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>): void {
    onPaste?.(event);
    if (event.defaultPrevented) {
      return;
    }
    // maxLength would truncate "123 456" before the digits are extracted.
    event.preventDefault();
    const input = event.currentTarget;
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '');
    if (!pasted) {
      return;
    }
    const start = input.selectionStart ?? value.length;
    const end = input.selectionEnd ?? start;
    const next =
      pasted.length >= length
        ? pasted.slice(0, length)
        : onlyDigits(value.slice(0, start) + pasted + value.slice(end), length);
    commit(next);
  }

  function handleClick(event: MouseEvent<HTMLInputElement>): void {
    onClick?.(event);
    // The transparent text doesn't line up with the slots: map the click to a slot.
    const input = event.currentTarget;
    const rect = input.getBoundingClientRect();
    const slot = Math.floor(((event.clientX - rect.left) / rect.width) * length);
    const caret = Math.max(0, Math.min(slot, value.length));
    input.setSelectionRange(caret, caret < value.length ? caret + 1 : caret);
    readSelection(input);
  }

  function handleFocus(event: FocusEvent<HTMLInputElement>): void {
    setFocused(true);
    const input = event.currentTarget;
    input.setSelectionRange(input.value.length, input.value.length);
    readSelection(input);
    onFocus?.(event);
  }

  function handleBlur(event: FocusEvent<HTMLInputElement>): void {
    setFocused(false);
    onBlur?.(event);
  }

  const collapsed = selection.start === selection.end;
  const activeStart = collapsed ? Math.min(selection.start, length - 1) : selection.start;
  const activeEnd = collapsed ? activeStart + 1 : selection.end;
  const showCaret = focused && collapsed && selection.start === value.length && value.length < length;

  return (
    <div
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget) {
          setShaking(false);
        }
      }}
      className={cn(
        'group relative w-full max-w-88',
        shaking && 'animate-shake motion-reduce:animate-none',
        containerClassName,
      )}
    >
      <div
        aria-hidden="true"
        className="grid gap-1.5 sm:gap-2"
        style={{ gridTemplateColumns: `repeat(${length}, minmax(0, 1fr))` }}
      >
        {Array.from({ length }, (_, index) => {
          const digit = value[index];
          const active = focused && index >= activeStart && index < activeEnd;
          return (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: slots are positional and never reorder
              key={index}
              style={{ animationDelay: `calc(var(--duration-stagger) * ${index})` }}
              className={cn(
                'relative flex h-12 animate-rise items-center justify-center rounded-md bg-surface shadow-xs ring-1 ring-inset sm:h-14',
                'font-display text-2xl text-ink tabular-nums sm:text-3xl',
                'transition-[box-shadow,outline-color,background-color] duration-(--duration-quick) ease-standard',
                invalid ? 'ring-danger' : 'ring-line-strong',
                !active && !invalid && !disabled && 'group-hover:ring-ink-subtle',
                active && 'outline-2',
                active &&
                  (invalid ? 'outline-offset-2 outline-danger' : 'outline-offset-0 outline-focus ring-transparent'),
                disabled && 'bg-surface-muted opacity-60',
              )}
            >
              {digit ? (
                <span
                  key={digit}
                  style={{ animationDelay: `calc(var(--duration-stagger) * ${Math.max(0, index - popFrom)})` }}
                  className="animate-digit-pop motion-reduce:animate-none"
                >
                  {digit}
                </span>
              ) : null}
              {showCaret && index === value.length ? (
                <span className="h-[1.1em] w-0.5 animate-caret-blink rounded-full bg-primary motion-reduce:animate-none" />
              ) : null}
            </div>
          );
        })}
      </div>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        autoCorrect="off"
        spellCheck={false}
        data-1p-ignore=""
        data-lpignore="true"
        maxLength={length}
        value={value}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        onChange={(event) => commit(onlyDigits(event.target.value, length))}
        onSelect={handleSelect}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onClick={handleClick}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={cn(
          'absolute inset-0 z-10 size-full cursor-text appearance-none rounded-md bg-transparent text-base text-transparent caret-transparent outline-none',
          'selection:bg-transparent selection:text-transparent disabled:cursor-not-allowed',
          // Keep the browser's autofill paint off the transparent field.
          'autofill:[transition:background-color_600000s_0s,color_600000s_0s] autofill:[-webkit-text-fill-color:transparent]',
          className,
        )}
        {...inputProps}
      />
    </div>
  );
}

export interface OtpFieldProps extends Omit<OtpInputProps, 'id' | 'invalid'> {
  /** Required: wires the label, hint and error to the input. */
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  /** Error message; when present the input is marked invalid. */
  error?: ReactNode;
  className?: string;
  inputClassName?: string;
}

/** Label + OTP input + hint/error, with ids and aria attributes connected. */
export function OtpField({
  id,
  label,
  hint,
  error,
  className,
  inputClassName,
  'aria-describedby': describedBy,
  ...inputProps
}: OtpFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedByIds = [describedBy, hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={id}>{label}</Label>
      <OtpInput
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
