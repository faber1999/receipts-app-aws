'use client';

import { type ChangeEvent, type DragEvent, useEffect, useId, useRef, useState } from 'react';
import { CameraIcon, ImageIcon, ReceiptIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { FieldError } from '@/components/ui/input';
import { useI18n } from '@/i18n/i18n-provider';
import { cn } from '@/lib/cn';
import { useMediaQuery } from '@/lib/use-media-query';
import { getUploadErrorKey, type UploadErrorKey } from '../errors';
import { prepareReceiptImage } from '../prepare-image';

/** What the picker offers; the photo is re-encoded as JPEG before it is sent anyway. */
const ACCEPT = 'image/jpeg,image/png';

export interface UploadReceiptDialogProps {
  open: boolean;
  /** Changes on every open, so the dialog starts clean (no stale error). */
  session: number;
  onClose: () => void;
  /** Uploads the prepared JPEG and closes the dialog; throws on failure so the dialog can say why. */
  onUpload: (image: Blob) => Promise<void>;
  fallbackFocus: () => HTMLElement | null;
}

export function UploadReceiptDialog({ open, session, onClose, onUpload, fallbackFocus }: UploadReceiptDialogProps) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const { upload } = t.receipts;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={upload.title}
      description={upload.description}
      dismissible={!busy}
      closeLabel={upload.close}
      fallbackFocus={fallbackFocus}
    >
      <UploadReceiptPanel key={session} busy={busy} setBusy={setBusy} onCancel={onClose} onUpload={onUpload} />
    </Dialog>
  );
}

type Phase = 'idle' | 'preparing' | 'uploading';

interface UploadReceiptPanelProps {
  busy: boolean;
  setBusy: (busy: boolean) => void;
  onCancel: () => void;
  onUpload: (image: Blob) => Promise<void>;
}

function UploadReceiptPanel({ busy, setBusy, onCancel, onUpload }: UploadReceiptPanelProps) {
  const { t } = useI18n();
  const { upload } = t.receipts;
  // Phones and tablets get a direct camera button; a desktop gets drag and drop instead.
  const touch = useMediaQuery('(pointer: coarse)');
  const cameraInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const primaryAction = useRef<HTMLButtonElement>(null);
  const status = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<UploadErrorKey | null>(null);
  const [dragging, setDragging] = useState(false);
  const promptId = useId();

  // The choices hide while busy, so focus moves to the progress and stays inside the dialog.
  useEffect(() => {
    if (phase !== 'idle') status.current?.focus();
  }, [phase]);

  // After a failure, back to the control that retries; the alert announces what went wrong.
  useEffect(() => {
    if (error) primaryAction.current?.focus();
  }, [error]);

  async function send(file: File): Promise<void> {
    setError(null);
    setPhase('preparing');
    setBusy(true);
    try {
      const image = await prepareReceiptImage(file);
      setPhase('uploading');
      await onUpload(image);
    } catch (failure: unknown) {
      setError(getUploadErrorKey(failure));
      setPhase('idle');
      setBusy(false);
      return;
    }
    setBusy(false);
  }

  function handlePicked(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    // Reset so picking the same photo again (after an error) still fires a change.
    event.target.value = '';
    if (file) void send(file);
  }

  function handleDragOver(event: DragEvent<HTMLFieldSetElement>): void {
    if (busy || !event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setDragging(true);
  }

  function handleDragLeave(event: DragEvent<HTMLFieldSetElement>): void {
    // Moving onto a child fires dragleave on the zone; only a real exit clears the state.
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
    setDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLFieldSetElement>): void {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (!busy && file) void send(file);
  }

  const progress = phase === 'uploading' ? upload.uploading : upload.preparing;

  return (
    <>
      <DialogBody className="flex flex-col gap-4">
        {/* A drop target for pointer users; the buttons inside are the keyboard and screen reader way in. */}
        <fieldset
          aria-labelledby={promptId}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          data-dragging={dragging || undefined}
          className={cn(
            'grid min-w-0 place-items-center rounded-lg border border-dashed border-line-strong/60 px-5 py-7 text-center',
            'transition-[background-color,border-color] duration-(--duration-quick) ease-standard',
            'data-dragging:border-primary data-dragging:bg-primary-soft',
          )}
        >
          <div
            aria-hidden={busy || undefined}
            className={cn('flex flex-col items-center [grid-area:1/1]', busy && 'invisible')}
          >
            <span className="grid size-11 place-items-center rounded-md bg-primary-soft text-primary-ink">
              <ReceiptIcon className="size-5" />
            </span>
            <p id={promptId} className="mt-3 font-medium text-ink">
              {dragging ? upload.dropActive : upload.prompt}
            </p>
            <p className="mt-1 text-sm text-ink-muted">
              {touch ? upload.formats : `${upload.dropHint} ${upload.formats}.`}
            </p>
            <div className="mt-5 flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              {touch ? (
                <>
                  <Button ref={primaryAction} onClick={() => cameraInput.current?.click()} className="pl-3.5">
                    <CameraIcon />
                    {upload.takePhoto}
                  </Button>
                  <Button variant="secondary" onClick={() => fileInput.current?.click()} className="pl-3.5">
                    <ImageIcon />
                    {upload.choosePhoto}
                  </Button>
                </>
              ) : (
                <Button ref={primaryAction} onClick={() => fileInput.current?.click()} className="pl-3.5">
                  <ImageIcon />
                  {upload.chooseFile}
                </Button>
              )}
            </div>
          </div>

          {/* Same grid cell as the choices, so the zone keeps its height while busy. */}
          <div
            ref={status}
            tabIndex={-1}
            className={cn(
              'flex flex-col items-center rounded-xs [grid-area:1/1] focus-visible:outline-offset-4',
              !busy && 'invisible',
            )}
          >
            <span aria-hidden="true" className="t-shimmer font-medium" data-text={progress}>
              {progress}
            </span>
          </div>
          {/* Always mounted, so each phase is announced politely. */}
          <p role="status" className="sr-only">
            {busy ? progress : ''}
          </p>
        </fieldset>

        <p className="rounded-md bg-surface-muted px-3.5 py-3 text-sm text-ink-muted">
          <span className="font-medium text-ink">{upload.tipLead}</span> {upload.tip}
        </p>

        {error ? <FieldError role="alert">{upload.errors[error]}</FieldError> : null}

        <input ref={cameraInput} type="file" accept={ACCEPT} capture="environment" hidden onChange={handlePicked} />
        <input ref={fileInput} type="file" accept={ACCEPT} hidden onChange={handlePicked} />
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" disabled={busy} onClick={onCancel}>
          {upload.cancel}
        </Button>
      </DialogFooter>
    </>
  );
}
