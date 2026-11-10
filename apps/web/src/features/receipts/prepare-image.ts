import { MAX_RECEIPT_BYTES } from '@receipts-app/contracts';
import { fitWithin, RECEIPT_JPEG_QUALITY } from './resize';

/** The type every prepared receipt is encoded as. */
export const PREPARED_RECEIPT_TYPE = 'image/jpeg';

export type ReceiptImageErrorCode = 'unreadable' | 'tooLarge';

/** The photo could not be turned into an uploadable JPEG. */
export class ReceiptImageError extends Error {
  readonly code: ReceiptImageErrorCode;

  constructor(code: ReceiptImageErrorCode, message: string) {
    super(message);
    this.name = 'ReceiptImageError';
    this.code = code;
  }
}

interface DecodedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
}

async function decodeWithBitmap(file: Blob): Promise<DecodedImage> {
  // 'from-image' applies the EXIF orientation, so phone photos are not drawn sideways.
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
}

async function decodeWithElement(file: Blob): Promise<DecodedImage> {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = 'async';
  image.src = url;
  try {
    await image.decode();
  } catch (error: unknown) {
    URL.revokeObjectURL(url);
    throw error;
  }
  return {
    source: image,
    width: image.naturalWidth,
    height: image.naturalHeight,
    release: () => URL.revokeObjectURL(url),
  };
}

async function decode(file: Blob): Promise<DecodedImage> {
  try {
    return await decodeWithBitmap(file);
  } catch {
    // Some engines decode more formats through <img> than through createImageBitmap (e.g. HEIC in Safari).
    try {
      return await decodeWithElement(file);
    } catch {
      throw new ReceiptImageError('unreadable', 'The image could not be decoded');
    }
  }
}

function toJpeg(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, PREPARED_RECEIPT_TYPE, RECEIPT_JPEG_QUALITY));
}

/**
 * Turns any photo the browser can decode into a JPEG whose longest edge is at most
 * RECEIPT_MAX_EDGE: a quick upload that stays within the AI image limits.
 * Browser only (canvas). Throws ReceiptImageError.
 */
export async function prepareReceiptImage(file: Blob): Promise<Blob> {
  if (file.size === 0) throw new ReceiptImageError('unreadable', 'The file is empty');

  const image = await decode(file);
  try {
    if (image.width === 0 || image.height === 0) {
      throw new ReceiptImageError('unreadable', 'The image has no pixels');
    }
    const size = fitWithin({ width: image.width, height: image.height });
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext('2d');
    if (!context) throw new ReceiptImageError('unreadable', 'Canvas 2D is not available');

    // JPEG has no alpha: paint white first so a transparent PNG does not turn black.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, size.width, size.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(image.source, 0, 0, size.width, size.height);

    const blob = await toJpeg(canvas);
    if (!blob || blob.size === 0) throw new ReceiptImageError('unreadable', 'The image could not be encoded');
    if (blob.size > MAX_RECEIPT_BYTES) throw new ReceiptImageError('tooLarge', 'The image is still too large');
    return blob;
  } finally {
    image.release();
  }
}
