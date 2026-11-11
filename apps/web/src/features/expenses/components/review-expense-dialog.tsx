'use client';

import type { CreateExpenseInput } from '@receipts-app/contracts';
import { type RefObject, type SubmitEvent, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { ExternalLinkIcon, ZoomInIcon, ZoomOutIcon } from '@/components/icons';
import { Button, buttonStyles } from '@/components/ui/button';
import { Dialog, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { FieldError } from '@/components/ui/input';
import { ReceiptPhoto, type ReceiptPhotoFit } from '@/features/receipts/components/receipt-photo';
import type { ReceiptPhotoLoader } from '@/features/receipts/photo-url';
import { useReceiptPhoto } from '@/features/receipts/use-receipt-photo';
import { useI18n } from '@/i18n/i18n-provider';
import { cn } from '@/lib/cn';
import { useMediaQuery } from '@/lib/use-media-query';
import { apiFieldErrors, type ExpenseErrorKey, getConfirmErrorKey } from '../errors';
import { formatLongDate } from '../format';
import { dateNeedsCheck, reviewDraft, unreadFields } from '../review';
import { type ExpenseFieldErrors, parseExpenseForm } from '../schemas';
import { type CompletableExpense, uploadDay } from '../status';
import { type ExpenseFieldNotes, ExpenseFields, expenseFieldId, focusFirstInvalid } from './expense-fields';

export interface ReviewExpenseDialogProps {
  open: boolean;
  /** Changes on every open, so the form starts from what was read, with no stale errors. */
  session: number;
  /** The receipt to review (REVIEW) or complete (FAILED). Kept while closing so the exit shows the same content. */
  expense: CompletableExpense | null;
  onClose: () => void;
  /** Confirms with every field (POST /expenses/{id}/confirm); throws an ApiError (or anything) on failure. */
  onConfirm: (expense: CompletableExpense, input: CreateExpenseInput) => Promise<void>;
  loadPhoto: ReceiptPhotoLoader;
  fallbackFocus: () => HTMLElement | null;
}

/**
 * "Review what the AI read": the receipt photo beside the expense form (stacked on small
 * screens, photo first at a modest height so the form stays one scroll away). The form starts
 * from whatever was read; fields it could not read start empty with a note, and a date equal to
 * the upload day asks to be checked. Saving confirms the expense, which only then counts.
 */
export function ReviewExpenseDialog({
  open,
  session,
  expense,
  onClose,
  onConfirm,
  loadPhoto,
  fallbackFocus,
}: ReviewExpenseDialogProps) {
  const { t } = useI18n();
  const [saving, setSaving] = useState(false);
  const initialFocus = useRef<HTMLElement | null>(null);
  const copy = t.expenses.review;
  const failed = expense?.status === 'FAILED';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={failed ? copy.completeTitle : copy.reviewTitle}
      description={
        expense ? (failed ? copy.completeDescription : copy.reviewDescription(unreadFields(expense).length)) : undefined
      }
      dismissible={!saving}
      closeLabel={copy.close}
      initialFocusRef={initialFocus}
      fallbackFocus={fallbackFocus}
      className="sm:max-w-xl md:max-w-4xl"
    >
      {expense ? (
        <ReviewForm
          key={session}
          expense={expense}
          active={open}
          saving={saving}
          setSaving={setSaving}
          initialFocus={initialFocus}
          onCancel={onClose}
          onConfirm={onConfirm}
          loadPhoto={loadPhoto}
        />
      ) : null}
    </Dialog>
  );
}

interface ReviewFormProps {
  expense: CompletableExpense;
  /** False while the dialog is closed (or closing): the photo stops fetching and renewing. */
  active: boolean;
  saving: boolean;
  setSaving: (saving: boolean) => void;
  initialFocus: RefObject<HTMLElement | null>;
  onCancel: () => void;
  onConfirm: (expense: CompletableExpense, input: CreateExpenseInput) => Promise<void>;
  loadPhoto: ReceiptPhotoLoader;
}

function ReviewForm({
  expense,
  active,
  saving,
  setSaving,
  initialFocus,
  onCancel,
  onConfirm,
  loadPhoto,
}: ReviewFormProps) {
  const { t, intlLocale } = useI18n();
  const id = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [fieldErrors, setFieldErrors] = useState<ExpenseFieldErrors>({});
  const [formError, setFormError] = useState<ExpenseErrorKey | null>(null);
  // After a failed confirm, focus goes back into the form once it is enabled again: to the first field
  // the API rejected, or to the submit button (disabling it while saving dropped focus to the page).
  const [refocus, setRefocus] = useState<ExpenseFieldErrors | 'submit' | null>(null);
  const submitRef = useRef<HTMLButtonElement>(null);
  const wide = useMediaQuery('(min-width: 48rem)');
  const copy = t.expenses.review;
  const failed = expense.status === 'FAILED';

  // Fixed for the session (the component is keyed by it), like the form's default values: a row that
  // changes meanwhile (e.g. a refresh after a conflict) never rewrites what the person is typing.
  const [setup] = useState(() => {
    const unread = unreadFields(expense);
    return { defaults: reviewDraft(expense), unread, checkDate: dateNeedsCheck(expense), firstUnread: unread[0] };
  });
  const notes: ExpenseFieldNotes = {};
  // A FAILED receipt had nothing read: the description says so once, instead of a note on every field.
  if (!failed) for (const field of setup.unread) notes[field] = copy.notRead;
  if (setup.checkDate) notes.date = copy.checkDate;

  // Side by side, start at the first field to fill in (or the merchant when everything was read).
  // Stacked on a phone, focus stays at the top (the photo) so no keyboard covers the receipt.
  useLayoutEffect(() => {
    initialFocus.current = wide ? document.getElementById(expenseFieldId(id, setup.firstUnread ?? 'merchant')) : null;
  }, [wide, id, setup.firstUnread, initialFocus]);

  useEffect(() => {
    if (saving || !refocus || !formRef.current) return;
    if (refocus === 'submit') submitRef.current?.focus();
    else focusFirstInvalid(formRef.current, id, refocus);
    setRefocus(null);
  }, [saving, refocus, id]);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const formElement = event.currentTarget;
    setFormError(null);

    const parsed = parseExpenseForm(new FormData(formElement));
    if (!parsed.success) {
      setFieldErrors(parsed.errors);
      focusFirstInvalid(formElement, id, parsed.errors);
      return;
    }

    setFieldErrors({});
    setSaving(true);
    try {
      await onConfirm(expense, parsed.data);
    } catch (error: unknown) {
      const rejected = apiFieldErrors(error);
      setFieldErrors(rejected);
      setFormError(getConfirmErrorKey(error));
      setRefocus(Object.keys(rejected).length > 0 ? rejected : 'submit');
    } finally {
      setSaving(false);
    }
  }

  const merchant = expense.status === 'REVIEW' ? expense.merchant : undefined;
  const alt = merchant
    ? t.receipts.photo.alt(merchant)
    : t.receipts.photo.uploadedAlt(formatLongDate(uploadDay(expense), intlLocale));

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate>
      <DialogBody className="grid gap-5 md:grid-cols-2 md:gap-6">
        <ReviewPhoto expenseId={expense.id} active={active} alt={alt} loadPhoto={loadPhoto} />
        <div className="flex min-w-0 flex-col">
          {/* A disabled fieldset locks every control while the request is in flight. */}
          <fieldset disabled={saving} className="flex min-w-0 flex-col gap-4">
            <ExpenseFields
              idPrefix={id}
              defaults={setup.defaults}
              errors={fieldErrors}
              notes={notes}
              placeholders={{ currency: copy.chooseCurrency, category: copy.chooseCategory }}
              stacked
            />
          </fieldset>
          {formError ? (
            <FieldError role="alert" className="mt-4">
              {t.expenses.apiErrors[formError]}
            </FieldError>
          ) : null}
        </div>
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" disabled={saving} onClick={onCancel}>
          {copy.cancel}
        </Button>
        <Button ref={submitRef} type="submit" disabled={saving}>
          {saving ? copy.saving : failed ? copy.submitComplete : copy.submitReview}
        </Button>
      </DialogFooter>
    </form>
  );
}

interface ReviewPhotoProps {
  expenseId: string;
  active: boolean;
  alt: string;
  loadPhoto: ReceiptPhotoLoader;
}

/** The photo column: a frame sized to sit beside the form (or above it), plus zoom and the original. */
function ReviewPhoto({ expenseId, active, alt, loadPhoto }: ReviewPhotoProps) {
  const { t } = useI18n();
  const copy = t.receipts.photo;
  const photo = useReceiptPhoto(expenseId, loadPhoto, active);
  const [fit, setFit] = useState<ReceiptPhotoFit>('contain');
  const url = photo.state.status === 'ready' ? photo.state.photo.url : null;
  const actionClass = 'pl-2.5';

  return (
    <section aria-label={t.expenses.review.photoLabel} className="flex min-w-0 flex-col gap-2">
      {/* Phone: a 15rem window (zoom in to read the small print); side by side: as tall as the dialog allows. */}
      <ReceiptPhoto photo={photo} alt={alt} fit={fit} className="h-60 md:h-[clamp(20rem,calc(100dvh-17rem),36rem)]" />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="ghost"
          size="sm"
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
            className={cn(buttonStyles({ variant: 'ghost', size: 'sm' }), actionClass)}
          >
            <ExternalLinkIcon />
            {copy.openOriginal}
            <span className="sr-only">{` ${copy.newTab}`}</span>
          </a>
        ) : (
          <Button variant="ghost" size="sm" disabled className={actionClass}>
            <ExternalLinkIcon />
            {copy.openOriginal}
          </Button>
        )}
      </div>
    </section>
  );
}
