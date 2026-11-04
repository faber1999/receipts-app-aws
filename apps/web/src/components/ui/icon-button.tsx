'use client';

import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Tooltip, type TooltipAlign, type TooltipSide } from './tooltip';

export interface IconButtonProps extends Omit<ComponentPropsWithoutRef<'button'>, 'aria-label' | 'children'> {
  /** Accessible name (can be more specific than the tooltip, e.g. "Edit Green Valley Market"). */
  label: string;
  /** Short visible hint; defaults to the label. */
  tooltip?: string;
  tooltipSide?: TooltipSide;
  tooltipAlign?: TooltipAlign;
  /** 'danger' tints the hover state for destructive actions. */
  tone?: 'default' | 'danger';
  children: ReactNode;
}

/**
 * Icon-only button: 32px visual chip with a 40px hit area (pseudo-element), always
 * named for assistive tech and hinted with <Tooltip> for sighted pointer and keyboard users.
 * Space adjacent icon buttons at least 8px apart so their hit areas never overlap.
 */
export function IconButton({
  label,
  tooltip,
  tooltipSide = 'bottom',
  tooltipAlign = 'center',
  tone = 'default',
  type = 'button',
  className,
  children,
  ...props
}: IconButtonProps) {
  const hint = tooltip ?? label;

  return (
    <Tooltip content={hint} describe={hint !== label && !label.includes(hint)} side={tooltipSide} align={tooltipAlign}>
      <button
        type={type}
        aria-label={label}
        className={cn(
          'relative grid size-8 place-items-center rounded-sm text-ink-muted',
          'before:absolute before:-inset-1 before:content-[""]',
          'transition-[color,background-color,scale] duration-(--duration-quick) ease-standard active:scale-(--scale-press)',
          'hover:bg-surface-muted disabled:pointer-events-none disabled:opacity-40',
          tone === 'danger' ? 'hover:text-danger' : 'hover:text-ink',
          className,
        )}
        {...props}
      >
        {children}
      </button>
    </Tooltip>
  );
}
