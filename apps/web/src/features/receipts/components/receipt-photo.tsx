'use client';

import { useRef } from 'react';
import { AlertIcon, RefreshIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n/i18n-provider';
import { cn } from '@/lib/cn';
import type { PhotoErrorKey } from '../errors';
import type { ReceiptPhotoController } from '../use-receipt-photo';

/** 'contain' shows the whole receipt; 'width' fills the width and scrolls the length. */
export type ReceiptPhotoFit = 'contain' | 'width';

export interface ReceiptPhotoProps {
  /** From useReceiptPhoto(), so the caller can also use the URL (e.g. an "open original" link). */
  photo: ReceiptPhotoController;
  alt: string;
  fit?: ReceiptPhotoFit;
  /** Sizes the frame. It needs a definite height for 'contain' to fit and for 'width' to scroll. */
  className?: string;
}

/** Errors a new URL cannot fix: retrying only repeats them. */
const FINAL_ERRORS: ReadonlySet<PhotoErrorKey> = new Set(['notFound', 'unauthorized']);

/**
 * A receipt photo in a neutral frame that fills whatever box the caller gives it, so it
 * works as a large viewer or beside a form. Shows a paper placeholder until the image has
 * actually loaded, then reveals it; failures stay inside the frame with a retry.
 */
export function ReceiptPhoto({ photo, alt, fit = 'contain', className }: ReceiptPhotoProps) {
  const { t } = useI18n();
  const copy = t.receipts.photo;
  const frame = useRef<HTMLDivElement>(null);
  const { state } = photo;
  const placeholder = state.status === 'loading' || (state.status === 'ready' && state.image === 'loading');

  const image =
    state.status === 'ready' ? (
      // A plain <img>: the export has no image optimizer, and the presigned S3 URL is already the final file.
      // biome-ignore lint/performance/noImgElement: static export; next/image optimization is unavailable
      <img
        src={state.photo.url}
        alt={alt}
        decoding="async"
        onLoad={photo.onImageLoad}
        onError={photo.onImageError}
        className={cn(
          'rounded-xs bg-surface outline-1 -outline-offset-1 outline-black/10',
          fit === 'contain' ? 'max-h-full max-w-full object-contain' : 'block h-auto w-full',
          state.image === 'loaded' ? 'animate-reveal' : 'opacity-0',
        )}
      />
    ) : null;

  function retry(): void {
    // The retry button unmounts; keep focus inside the frame (and the dialog) while it reloads.
    frame.current?.focus();
    photo.retry();
  }

  return (
    <div
      ref={frame}
      tabIndex={-1}
      className={cn('relative overflow-hidden rounded-md bg-surface-muted focus-visible:outline-offset-0', className)}
    >
      {state.status === 'ready' ? (
        fit === 'width' ? (
          // Zoomed in, the frame scrolls: a named region with a tab stop, so keyboard users can scroll it too.
          <section
            aria-label={copy.zoomedRegion}
            // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be keyboard-focusable (WCAG 2.1.1)
            tabIndex={0}
            className="size-full overflow-y-auto overscroll-contain p-3 focus-visible:-outline-offset-2"
          >
            {image}
          </section>
        ) : (
          <div className="flex size-full items-center justify-center p-3">{image}</div>
        )
      ) : null}

      {placeholder ? <PhotoPlaceholder label={copy.loading} /> : null}

      {state.status === 'error' ? (
        <div
          role="alert"
          className="absolute inset-0 flex animate-reveal flex-col items-center justify-center gap-4 p-6 text-center"
        >
          <span className="grid size-9 place-items-center rounded-md bg-danger-soft text-danger">
            <AlertIcon />
          </span>
          <p className="max-w-xs text-sm text-pretty text-ink">{copy.errors[state.error]}</p>
          {FINAL_ERRORS.has(state.error) ? null : (
            <Button variant="secondary" size="sm" onClick={retry} className="pl-2.5">
              <RefreshIcon />
              {copy.retry}
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}

/**
 * A blank receipt in the brand's torn-paper shape, pulsing. It fades in after a short
 * intent delay, so a cached photo never flashes it.
 */
function PhotoPlaceholder({ label }: { label: string }) {
  return (
    <div className="absolute inset-0 grid animate-reveal place-items-center [animation-delay:var(--duration-micro)]">
      <p role="status" className="sr-only">
        {label}
      </p>
      <div aria-hidden="true" className="receipt-shadow">
        <div className="receipt-edge flex w-28 flex-col gap-2.5 rounded-t-md bg-surface px-4 pt-5 pb-8">
          {['w-3/5', 'w-full', 'w-4/5', 'w-full', 'w-2/3'].map((width, index) => (
            <div
              key={width + String(index)}
              className={cn(
                'h-1.5 animate-pulse rounded-full motion-reduce:animate-none',
                index === 0 ? 'bg-primary-soft' : 'bg-surface-muted',
                width,
              )}
            />
          ))}
          <div className="mt-1 h-1.5 w-2/5 animate-pulse self-end rounded-full bg-line motion-reduce:animate-none" />
        </div>
      </div>
    </div>
  );
}
