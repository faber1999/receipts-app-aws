'use client';

import type { FocusEvent, ReactElement, ReactNode, PointerEvent as ReactPointerEvent } from 'react';
import { cloneElement, useEffect, useId, useState } from 'react';
import { cn } from '@/lib/cn';

export type TooltipSide = 'top' | 'bottom';
export type TooltipAlign = 'start' | 'center' | 'end';

/** The only prop the tooltip writes on its trigger. */
export interface TooltipTriggerProps {
  'aria-describedby'?: string;
}

export interface TooltipProps {
  /** Short hint text. Keep it to a few words; it is not a place for interactive content. */
  content: ReactNode;
  /** A single focusable element (button or link). */
  children: ReactElement<TooltipTriggerProps>;
  side?: TooltipSide;
  /** Horizontal anchor. Use 'end' for triggers at the right edge of the viewport. */
  align?: TooltipAlign;
  /**
   * Wire `aria-describedby` from the trigger to the tooltip (default true).
   * Turn it off when the content repeats the trigger's accessible name, so
   * screen readers do not announce it twice; the bubble is then aria-hidden.
   */
  describe?: boolean;
  className?: string;
}

const sideClasses: Record<TooltipSide, string> = {
  // The pseudo-element bridges the offset gap so the pointer can travel onto the bubble (SC 1.4.13 hoverable).
  bottom:
    'top-full mt-(--tt-offset) translate-y-[calc(var(--distance-micro)*-1)] before:bottom-full before:h-(--tt-offset)',
  top: 'bottom-full mb-(--tt-offset) translate-y-(--distance-micro) before:top-full before:h-(--tt-offset)',
};

const alignClasses: Record<TooltipAlign, string> = {
  start: 'left-0',
  center: 'left-1/2 -translate-x-1/2',
  end: 'right-0',
};

const originClasses: Record<TooltipSide, Record<TooltipAlign, string>> = {
  bottom: { start: 'origin-top-left', center: 'origin-top', end: 'origin-top-right' },
  top: { start: 'origin-bottom-left', center: 'origin-bottom', end: 'origin-bottom-right' },
};

/**
 * Styled hover/focus hint. The app never uses the native `title` attribute for
 * UI hints (it cannot be styled, delays ~1s, and never shows on keyboard focus);
 * wrap the trigger in `<Tooltip>` instead.
 *
 * Behavior (transitions.dev tooltip recipe, WCAG 1.4.13):
 * - Mouse/pen hover opens after the --tt-delay intent delay; keyboard focus
 *   (:focus-visible) opens immediately. Touch never opens it, so a tap leaves
 *   nothing stuck on screen.
 * - Closes on pointer leave, blur, pointer down, and Escape (focus stays put).
 * - The pointer can move onto the bubble without it closing, and it stays
 *   until one of the above happens.
 */
export function Tooltip({
  content,
  children,
  side = 'bottom',
  align = 'center',
  describe = true,
  className,
}: TooltipProps) {
  const id = useId();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [instant, setInstant] = useState(false);
  const open = (hovered || focused) && !dismissed;

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setDismissed(true);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  function handlePointerEnter(event: ReactPointerEvent<HTMLSpanElement>) {
    if (event.pointerType === 'touch') return;
    setDismissed(false);
    setInstant(false);
    setHovered(true);
  }

  function handleFocus(event: FocusEvent<HTMLSpanElement>) {
    // Pointer clicks also focus buttons; only keyboard focus should reveal the hint.
    if (!event.target.matches(':focus-visible')) return;
    setDismissed(false);
    setInstant(true);
    setFocused(true);
  }

  const trigger = describe
    ? cloneElement(children, {
        'aria-describedby': cn(children.props['aria-describedby'], id),
      })
    : children;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the wrapper only observes hover and focus of its trigger; the trigger itself is the interactive element
    <span
      className={cn('relative inline-flex', className)}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={() => setHovered(false)}
      onPointerDown={() => setDismissed(true)}
      onFocus={handleFocus}
      onBlur={() => setFocused(false)}
    >
      {trigger}
      <span
        id={id}
        role="tooltip"
        aria-hidden={describe ? undefined : true}
        data-state={open ? 'open' : 'closed'}
        data-instant={instant ? '' : undefined}
        className={cn(
          'pointer-events-none absolute z-50 w-max max-w-[min(16rem,calc(100vw-2rem))]',
          'rounded-sm bg-ink px-2 py-1 text-xs leading-4 font-medium text-surface shadow-md',
          'before:absolute before:inset-x-0 before:content-[""]',
          sideClasses[side],
          alignClasses[align],
          originClasses[side][align],
          // Leave: no delay, quick fade. Enter: intent delay, then fade + scale + a few px toward rest.
          'scale-(--tt-scale) opacity-0 transition-[opacity,scale,translate] duration-(--tt-out-dur) ease-(--tt-ease)',
          'data-[state=open]:pointer-events-auto data-[state=open]:translate-y-0 data-[state=open]:scale-100 data-[state=open]:opacity-100',
          'data-[state=open]:delay-(--tt-delay) data-[state=open]:duration-(--tt-in-dur) data-[state=open]:data-instant:delay-0',
          'motion-reduce:translate-y-0 motion-reduce:scale-100',
        )}
      >
        {content}
      </span>
    </span>
  );
}
