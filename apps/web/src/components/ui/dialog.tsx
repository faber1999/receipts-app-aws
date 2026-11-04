'use client';

import { type MouseEvent, type ReactNode, type RefObject, type SyntheticEvent, useEffect, useId, useRef } from 'react';
import { CloseIcon } from '@/components/icons';
import { cn } from '@/lib/cn';
import { Tooltip } from './tooltip';

export interface DialogProps {
  /** Controlled open state. The dialog never closes itself; it asks through onClose. */
  open: boolean;
  /** Called on Escape, the close button, or a backdrop click (when enabled). */
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  /** 'alertdialog' for confirmations that interrupt (e.g. delete). */
  role?: 'dialog' | 'alertdialog';
  /** When false, Escape, the close button and the backdrop do nothing (e.g. while saving). */
  dismissible?: boolean;
  /** Close when the backdrop is clicked. Off by default so a stray click never discards a form. */
  closeOnBackdrop?: boolean;
  /** Accessible label of the corner close button; omit to hide the button. */
  closeLabel?: string;
  /** Element focused when the dialog opens; defaults to the first focusable element. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Focus target on close when the element that opened the dialog no longer exists. */
  fallbackFocus?: () => HTMLElement | null;
  className?: string;
}

/**
 * Modal dialog on the native <dialog> + showModal(): the browser provides the
 * focus trap, inert page, top layer and Escape. This wrapper keeps it
 * controlled, returns focus to the opener (or a fallback when the opener was
 * removed, e.g. a deleted row), and adds the transitions.dev modal motion
 * (the .t-modal rules in globals.css).
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  role = 'dialog',
  dismissible = true,
  closeOnBackdrop = false,
  closeLabel,
  initialFocusRef,
  fallbackFocus,
  className,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || open === wasOpen.current) return;
    wasOpen.current = open;

    if (open) {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      if (!dialog.open) dialog.showModal();
      initialFocusRef?.current?.focus();
      return;
    }

    if (dialog.open) dialog.close();
    const target = opener.current?.isConnected ? opener.current : (fallbackFocus?.() ?? null);
    target?.focus();
    opener.current = null;
  }, [open, initialFocusRef, fallbackFocus]);

  function handleCancel(event: SyntheticEvent<HTMLDialogElement>): void {
    // React owns the open state: Escape asks to close instead of closing natively.
    event.preventDefault();
    if (dismissible) onClose();
  }

  function handleNativeClose(): void {
    // Only when the browser force-closed it (e.g. a repeated Escape); our own close() already synced.
    if (wasOpen.current) onClose();
  }

  function handleClick(event: MouseEvent<HTMLDialogElement>): void {
    // The panel fills the dialog box, so a click whose target is the dialog itself hit the backdrop.
    if (closeOnBackdrop && dismissible && event.target === event.currentTarget) onClose();
  }

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: backdrop click is a pointer shortcut; Escape is the keyboard equivalent
    <dialog
      ref={ref}
      role={role === 'alertdialog' ? 'alertdialog' : undefined}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={handleCancel}
      onClose={handleNativeClose}
      onClick={handleClick}
      className={cn(
        't-modal m-auto w-[calc(100%-2rem)] max-w-md overflow-visible rounded-xl bg-transparent p-0 text-ink',
        'max-h-[calc(100dvh-2rem)]',
        className,
      )}
    >
      <div className="relative flex max-h-[calc(100dvh-2rem)] flex-col overflow-y-auto rounded-xl bg-surface shadow-lg">
        <div className={cn('flex flex-col gap-1.5 px-5 pt-5 sm:px-6 sm:pt-6', closeLabel && 'pr-14')}>
          <h2 id={titleId} className="text-lg leading-snug font-semibold tracking-tight text-ink">
            {title}
          </h2>
          {description ? (
            <p id={descriptionId} className="text-sm text-ink-muted">
              {description}
            </p>
          ) : null}
        </div>
        {children}
        {/* After the content in DOM order, so showModal() focuses the first field, not the close button. */}
        {closeLabel ? (
          <div className="absolute top-3 right-3 flex">
            <Tooltip content={closeLabel} describe={false} align="end">
              <button
                type="button"
                aria-label={closeLabel}
                disabled={!dismissible}
                onClick={onClose}
                className={cn(
                  'relative grid size-9 place-items-center rounded-md text-ink-muted',
                  'before:absolute before:-inset-0.5 before:content-[""]',
                  'transition-[color,background-color] duration-(--duration-quick) ease-standard',
                  'hover:bg-surface-muted hover:text-ink disabled:opacity-50',
                )}
              >
                <CloseIcon />
              </button>
            </Tooltip>
          </div>
        ) : null}
      </div>
    </dialog>
  );
}

export interface DialogBodyProps {
  children: ReactNode;
  className?: string;
}

export function DialogBody({ children, className }: DialogBodyProps) {
  return <div className={cn('px-5 pt-5 sm:px-6', className)}>{children}</div>;
}

export function DialogFooter({ children, className }: DialogBodyProps) {
  return (
    <div
      className={cn(
        'flex flex-col-reverse gap-2 px-5 pt-6 pb-5 sm:flex-row sm:justify-end sm:gap-3 sm:px-6 sm:pb-6',
        className,
      )}
    >
      {children}
    </div>
  );
}
