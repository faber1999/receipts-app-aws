'use client';

import type { Expense } from '@receipts-app/contracts';
import { useState } from 'react';
import { ExternalLinkIcon, ZoomInIcon, ZoomOutIcon } from '@/components/icons';
import { Button, buttonStyles } from '@/components/ui/button';
import { Dialog, DialogBody } from '@/components/ui/dialog';
import { formatLongDate } from '@/features/expenses/format';
import { useI18n } from '@/i18n/i18n-provider';
import { cn } from '@/lib/cn';
import type { ReceiptPhotoLoader } from '../photo-url';
import { useReceiptPhoto } from '../use-receipt-photo';
import { ReceiptPhoto, type ReceiptPhotoFit } from './receipt-photo';

export interface ReceiptPhotoDialogProps {
  open: boolean;
  /** Changes on every open, so the viewer starts over (fit mode, fresh URL check). */
  session: number;
  /** The expense whose photo is shown; it must have an imageKey. */
  expense: Expense | null;
  onClose: () => void;
  loadPhoto: ReceiptPhotoLoader;
  fallbackFocus: () => HTMLElement | null;
}

/** Large view of an expense's receipt photo, titled with what the receipt is. */
export function ReceiptPhotoDialog({
  open,
  session,
  expense,
  onClose,
  loadPhoto,
  fallbackFocus,
}: ReceiptPhotoDialogProps) {
  const { t, intlLocale } = useI18n();
  const copy = t.receipts.photo;
  const date = expense ? formatLongDate(expense.date, intlLocale) : '';
  const merchant = expense?.status === 'PROCESSED' ? expense.merchant : null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={merchant ?? copy.title}
      description={expense ? (merchant ? date : copy.uploaded(date)) : undefined}
      closeLabel={copy.close}
      // Nothing to lose here, so a click outside the photo closes it, like any lightbox.
      closeOnBackdrop
      fallbackFocus={fallbackFocus}
      className="sm:max-w-xl"
    >
      {expense ? (
        <ReceiptPhotoPanel
          key={session}
          expenseId={expense.id}
          active={open}
          alt={merchant ? copy.alt(merchant) : copy.uploadedAlt(date)}
          loadPhoto={loadPhoto}
        />
      ) : null}
    </Dialog>
  );
}

interface ReceiptPhotoPanelProps {
  expenseId: string;
  /** False while the dialog is closed (or closing): stop fetching and renewing. */
  active: boolean;
  alt: string;
  loadPhoto: ReceiptPhotoLoader;
}

function ReceiptPhotoPanel({ expenseId, active, alt, loadPhoto }: ReceiptPhotoPanelProps) {
  const { t } = useI18n();
  const copy = t.receipts.photo;
  const photo = useReceiptPhoto(expenseId, loadPhoto, active);
  const [fit, setFit] = useState<ReceiptPhotoFit>('contain');
  const url = photo.state.status === 'ready' ? photo.state.photo.url : null;
  const actionClass = 'flex-1 pl-3.5 sm:flex-none';

  return (
    <>
      <DialogBody>
        {/* Receipts are tall: the frame takes the height the viewport leaves after the dialog's header and footer. */}
        <ReceiptPhoto photo={photo} alt={alt} fit={fit} className="h-[max(16rem,calc(100dvh-14rem))]" />
      </DialogBody>
      <div className="flex gap-2 px-5 pt-5 pb-5 sm:justify-between sm:gap-3 sm:px-6 sm:pb-6">
        <Button
          variant="secondary"
          disabled={photo.state.status !== 'ready'}
          onClick={() => setFit((current) => (current === 'contain' ? 'width' : 'contain'))}
          className={actionClass}
        >
          {fit === 'contain' ? <ZoomInIcon /> : <ZoomOutIcon />}
          {fit === 'contain' ? copy.zoomIn : copy.fit}
        </Button>
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonStyles({ variant: 'secondary' }), actionClass)}
          >
            <ExternalLinkIcon />
            {copy.openOriginal}
            <span className="sr-only">{` ${copy.newTab}`}</span>
          </a>
        ) : (
          <Button variant="secondary" disabled className={actionClass}>
            <ExternalLinkIcon />
            {copy.openOriginal}
          </Button>
        )}
      </div>
    </>
  );
}
