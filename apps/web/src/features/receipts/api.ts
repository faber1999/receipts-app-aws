import {
  type CreateReceiptUploadResponse,
  createReceiptUploadResponseSchema,
  type ReceiptContentType,
  type ReceiptPhotoResponse,
  receiptPhotoResponseSchema,
  type UnprocessedExpense,
} from '@receipts-app/contracts';
import { apiRequest } from '@/lib/api-client';
import { ReceiptStorageError } from './errors';
import { PREPARED_RECEIPT_TYPE } from './prepare-image';

/** POST /receipts: creates the PENDING expense and a presigned S3 POST for its photo. */
export async function createReceiptUpload(contentType: ReceiptContentType): Promise<CreateReceiptUploadResponse> {
  return createReceiptUploadResponseSchema.parse(await apiRequest('POST', '/receipts', { contentType }));
}

/**
 * Sends the photo straight to S3 with the presigned POST: the signed fields, then
 * Content-Type, then the file last (S3 ignores anything after it). No Authorization header.
 */
export async function postReceiptToStorage(
  upload: CreateReceiptUploadResponse['upload'],
  image: Blob,
  contentType: ReceiptContentType,
): Promise<void> {
  const form = new FormData();
  // The signed fields already include Content-Type. Merging (instead of appending it again) keeps it a single
  // field: a duplicate makes S3 reject the POST policy with 403.
  for (const [name, value] of Object.entries({ ...upload.fields, 'Content-Type': contentType })) {
    form.append(name, value);
  }
  form.append('file', image);

  const response = await fetch(upload.url, { method: 'POST', body: form });
  if (response.status !== 204) {
    throw new ReceiptStorageError(response.status);
  }
}

/**
 * Uploads a prepared JPEG and returns its PENDING expense. A photo that never reaches S3
 * would leave that expense PENDING forever, so it is deleted (best effort) before rethrowing.
 */
export async function uploadReceipt(image: Blob): Promise<UnprocessedExpense> {
  const { expense, upload } = await createReceiptUpload(PREPARED_RECEIPT_TYPE);
  try {
    await postReceiptToStorage(upload, image, PREPARED_RECEIPT_TYPE);
  } catch (error: unknown) {
    await apiRequest('DELETE', `/expenses/${expense.id}`).catch(() => undefined);
    throw error;
  }
  return expense;
}

/** GET /expenses/{id}/receipt: a presigned URL to view the photo, valid for a few minutes. 404 when it has none. */
export async function getReceiptPhoto(expenseId: string): Promise<ReceiptPhotoResponse> {
  return receiptPhotoResponseSchema.parse(
    await apiRequest('GET', `/expenses/${encodeURIComponent(expenseId)}/receipt`),
  );
}
