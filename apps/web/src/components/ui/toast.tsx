'use client';

import { CheckIcon } from '@/components/icons';
import { cn } from '@/lib/cn';

export interface ToastProps {
  /** The message; keep the last one while closing so the exit can play. */
  message: string | null;
  /** Changes for every new toast, so a repeated message is announced and animated again. */
  messageId?: number;
  open: boolean;
}

/**
 * Transient confirmation at the bottom of the viewport (transitions.dev toast:
 * the .t-toast rules in globals.css). The live region is always mounted, so
 * screen readers announce each new message politely.
 */
export function Toast({ message, messageId, open }: ToastProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4"
    >
      {message ? (
        <p
          key={messageId}
          className={cn(
            't-toast flex items-center gap-2 rounded-md bg-ink py-2.5 pr-4 pl-3 text-sm font-medium text-surface shadow-lg',
            open && 'is-open',
          )}
        >
          <CheckIcon className="text-primary-soft" />
          {message}
        </p>
      ) : null}
    </div>
  );
}
