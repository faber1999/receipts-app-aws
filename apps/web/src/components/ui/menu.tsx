'use client';

import Link from 'next/link';
import type {
  ComponentPropsWithoutRef,
  ComponentPropsWithRef,
  FocusEvent,
  KeyboardEvent,
  ReactNode,
  PointerEvent as ReactPointerEvent,
} from 'react';
import { createContext, use, useCallback, useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

export type MenuAlign = 'start' | 'end';

type MenuState = 'closed' | 'open' | 'closing';
type FocusTarget = 'first' | 'last';

interface MenuContextValue {
  close: (returnFocus: boolean) => void;
}

const MenuContext = createContext<MenuContextValue | null>(null);

function useMenu(): MenuContextValue {
  const context = use(MenuContext);
  if (!context) {
    throw new Error('Menu items must be rendered inside <Menu>.');
  }
  return context;
}

const ITEM_SELECTOR = '[role="menuitem"]';
const FALLBACK_CLOSE_MS = 150;

function closeDuration(): number {
  const value = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dropdown-close-dur'));
  return Number.isFinite(value) ? value : FALLBACK_CLOSE_MS;
}

export interface MenuProps {
  /** Visible content of the trigger button. */
  trigger: ReactNode;
  /** Accessible name of the trigger; it must contain any visible trigger text (SC 2.5.3). */
  triggerLabel: string;
  triggerClassName?: string;
  /**
   * Static, non-interactive content above the items (e.g. who is signed in).
   * It sits outside the `role="menu"` element, so arrow keys never land on it.
   */
  header?: ReactNode;
  /** Which edge of the positioning box the panel lines up with. Use 'end' for triggers on the right. */
  align?: MenuAlign;
  /** Classes for the root. It is `relative`; override (e.g. `max-sm:static`) to anchor the panel to an ancestor. */
  className?: string;
  contentClassName?: string;
  /** `MenuItem` / `MenuLinkItem` elements. */
  children: ReactNode;
}

/**
 * Menu button (WAI-ARIA APG pattern). The trigger toggles a `role="menu"` panel;
 * opening moves focus to the first item (ArrowUp on the trigger: the last one).
 * Inside: ArrowUp/ArrowDown move and wrap, Home/End jump, Escape closes and puts
 * focus back on the trigger, Tab closes and lets focus move on. A pointer press
 * outside closes it without stealing focus.
 * Motion: transitions.dev menu dropdown (`.t-dropdown` in globals.css).
 */
export function Menu({
  trigger,
  triggerLabel,
  triggerClassName,
  header,
  align = 'end',
  className,
  contentClassName,
  children,
}: MenuProps) {
  const triggerId = useId();
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<FocusTarget | null>(null);
  const closeTimer = useRef<number | undefined>(undefined);
  const [state, setState] = useState<MenuState>('closed');
  const open = state === 'open';

  const items = useCallback((): HTMLElement[] => {
    const menu = menuRef.current;
    return menu ? Array.from(menu.querySelectorAll<HTMLElement>(ITEM_SELECTOR)) : [];
  }, []);

  const close = useCallback((returnFocus: boolean) => {
    window.clearTimeout(closeTimer.current);
    setState((current) => (current === 'open' ? 'closing' : current));
    closeTimer.current = window.setTimeout(() => setState('closed'), closeDuration());
    if (returnFocus) {
      triggerRef.current?.focus();
    }
  }, []);

  function show(focus: FocusTarget): void {
    window.clearTimeout(closeTimer.current);
    pendingFocus.current = focus;
    setState('open');
  }

  // Focus waits for the commit: closed items are `visibility: hidden` and cannot take focus.
  useEffect(() => {
    if (!open || !pendingFocus.current) return;
    const list = items();
    const target = pendingFocus.current === 'first' ? list[0] : list[list.length - 1];
    pendingFocus.current = null;
    target?.focus();
  }, [open, items]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent): void {
      if (event.target instanceof Node && rootRef.current?.contains(event.target)) return;
      close(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open, close]);

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>): void {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      show('first');
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      show('last');
    }
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    const list = items();
    const active = document.activeElement;
    const index = active instanceof HTMLElement ? list.indexOf(active) : -1;
    let next: HTMLElement | undefined;

    switch (event.key) {
      case 'ArrowDown':
        next = list[(index + 1) % list.length];
        break;
      case 'ArrowUp':
        next = list[(index - 1 + list.length) % list.length];
        break;
      case 'Home':
        next = list[0];
        break;
      case 'End':
        next = list[list.length - 1];
        break;
      case 'Escape':
        event.preventDefault();
        close(true);
        return;
      case 'Tab':
        close(false);
        return;
      default:
        return;
    }

    event.preventDefault();
    next?.focus();
  }

  // Focus leaving the whole widget (e.g. a click elsewhere that moved focus) also closes it.
  function handleBlur(event: FocusEvent<HTMLDivElement>): void {
    if (!open) return;
    const next = event.relatedTarget;
    if (next instanceof Node && rootRef.current?.contains(next)) return;
    if (next === null) return;
    close(false);
  }

  return (
    <MenuContext value={{ close }}>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: the wrapper only observes focus leaving the widget; the trigger and items are the interactive elements */}
      <div ref={rootRef} className={cn('relative inline-flex', className)} onBlur={handleBlur}>
        <button
          ref={triggerRef}
          id={triggerId}
          type="button"
          aria-label={triggerLabel}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => (open ? close(false) : show('first'))}
          onKeyDown={handleTriggerKeyDown}
          className={triggerClassName}
        >
          {trigger}
        </button>
        <div
          data-state={state}
          data-origin={align === 'end' ? 'top-right' : 'top-left'}
          className={cn(
            't-dropdown absolute top-full z-40 mt-2 rounded-lg bg-surface p-1 shadow-lg',
            align === 'end' ? 'right-0' : 'left-0',
            contentClassName,
          )}
        >
          {header}
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-labelledby={triggerId}
            aria-orientation="vertical"
            tabIndex={-1}
            onKeyDown={handleMenuKeyDown}
            className="flex flex-col outline-none"
          >
            {children}
          </div>
        </div>
      </div>
    </MenuContext>
  );
}

/** Items share one look: a full-width row whose highlight follows focus (keyboard and pointer alike). */
const itemStyles =
  'flex h-10 w-full items-center gap-2 rounded-md px-2.5 text-left text-sm font-medium text-ink no-underline ' +
  'transition-[background-color,color] duration-(--duration-quick) ease-standard ' +
  // Keyboard focus keeps the global focus ring, drawn inside the row; pointer focus shows only the wash.
  'focus:bg-surface-muted focus:outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 ' +
  'focus-visible:outline-solid focus-visible:outline-focus ' +
  'aria-disabled:cursor-default aria-disabled:text-ink-muted aria-disabled:focus:bg-transparent';

// Pointer hover moves focus, so the keyboard and the mouse never highlight two rows at once.
function focusOnHover(event: ReactPointerEvent<HTMLElement>): void {
  if (event.pointerType === 'touch') return;
  if (document.activeElement !== event.currentTarget) {
    event.currentTarget.focus();
  }
}

export interface MenuItemProps
  extends Omit<ComponentPropsWithRef<'button'>, 'onSelect' | 'role' | 'type' | 'disabled'> {
  onSelect: () => void;
  /** Keep the menu open after selecting (e.g. to show progress on the item). Default false. */
  keepOpen?: boolean;
  /** Announced as unavailable but stays focusable, as the APG recommends for menu items. */
  disabled?: boolean;
  children: ReactNode;
}

export function MenuItem({
  onSelect,
  keepOpen = false,
  disabled = false,
  className,
  children,
  ...props
}: MenuItemProps) {
  const { close } = useMenu();

  function handleClick(): void {
    if (disabled) return;
    onSelect();
    if (!keepOpen) close(true);
  }

  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      aria-disabled={disabled || undefined}
      onClick={handleClick}
      onPointerMove={focusOnHover}
      className={cn(itemStyles, className)}
      {...props}
    >
      {children}
    </button>
  );
}

export interface MenuLinkItemProps extends Omit<ComponentPropsWithoutRef<typeof Link>, 'role'> {
  children: ReactNode;
}

export function MenuLinkItem({ className, onClick, children, ...props }: MenuLinkItemProps) {
  const { close } = useMenu();

  return (
    <Link
      role="menuitem"
      tabIndex={-1}
      onClick={(event) => {
        onClick?.(event);
        close(true);
      }}
      onPointerMove={focusOnHover}
      className={cn(itemStyles, className)}
      {...props}
    >
      {children}
    </Link>
  );
}
