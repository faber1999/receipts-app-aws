'use client';

import type { FocusEvent } from 'react';
import { AlertIcon, CheckIcon } from '@/components/icons';
import { cn } from '@/lib/cn';

export interface ToastAction {
  /** Visible label, e.g. "Review". */
  label: string;
  onAction: () => void;
}

export interface ToastProps {
  /** The message; keep the last one while closing so the exit can play. */
  message: string | null;
  /** Changes for every new toast, so a repeated message is announced and animated again. */
  messageId?: number;
  open: boolean;
  /** 'attention' swaps the check for an alert icon (something the person may want to act on). */
  tone?: 'success' | 'attention';
  /**
   * Optional shortcut. It must never be the only way to do the thing: the toast closes on its own,
   * so the same action has to exist on the page as well (WCAG 2.2.1).
   */
  action?: ToastAction;
  /**
   * Reports while the pointer is over the toast or focus is inside it, so the caller can hold
   * the auto-hide timer and nobody loses the action mid-reach.
   */
  onHoldChange?: (held: boolean) => void;
}

/**
 * Transient confirmation at the bottom of the viewport (transitions.dev toast:
 * the .t-toast rules in globals.css). The live region is always mounted, so
 * screen readers announce each new message politely. A closed toast is inert,
 * so its action never stays in the tab order while invisible.
 */
export function Toast({ message, messageId, open, tone = 'success', action, onHoldChange }: ToastProps) {
  function handleBlur(event: FocusEvent<HTMLDivElement>): void {
    if (!event.currentTarget.contains(event.relatedTarget)) onHoldChange?.(false);
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4"
    >
      {message ? (
        // biome-ignore lint/a11y/noStaticElementInteractions: hover and focus only hold the auto-hide timer; the action is a real button
        <div
          key={messageId}
          inert={!open}
          onPointerEnter={() => onHoldChange?.(true)}
          onPointerLeave={() => onHoldChange?.(false)}
          onFocus={() => onHoldChange?.(true)}
          onBlur={handleBlur}
          className={cn(
            't-toast flex max-w-md items-center gap-2 rounded-md bg-ink py-2.5 pr-4 pl-3 text-sm font-medium text-surface shadow-lg',
            action && 'pointer-events-auto gap-3 py-1.5 pr-1.5',
            open && 'is-open',
          )}
        >
          <span className="flex min-w-0 items-start gap-2">
            {tone === 'attention' ? (
              <AlertIcon className="mt-0.5 text-danger-soft" />
            ) : (
              <CheckIcon className="mt-0.5 text-primary-soft" />
            )}
            <span>{message}</span>
          </span>
          {action ? (
            <button
              type="button"
              onClick={action.onAction}
              className={cn(
                'relative h-8 shrink-0 rounded-sm px-3 font-semibold text-primary-soft',
                'transition-[background-color,scale] duration-(--duration-quick) ease-standard active:scale-(--scale-press)',
                'hover:bg-surface/10 focus-visible:outline-primary-soft',
              )}
            >
              {action.label}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
