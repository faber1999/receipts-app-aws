/**
 * Longest edge of an uploaded receipt photo. 1568 px is the size above which Claude's vision
 * input downscales anyway, so anything larger only costs upload time and bytes.
 */
export const RECEIPT_MAX_EDGE = 1568;

/** JPEG quality for the re-encoded photo: small files, text still crisp. */
export const RECEIPT_JPEG_QUALITY = 0.85;

export interface ImageSize {
  width: number;
  height: number;
}

/**
 * Scales a size so its longest edge is at most `maxEdge`, keeping the aspect ratio.
 * Never upscales; every edge stays at least 1 px.
 */
export function fitWithin(size: ImageSize, maxEdge: number = RECEIPT_MAX_EDGE): ImageSize {
  const { width, height } = size;
  if (!(Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0)) {
    throw new RangeError(`Invalid image size ${width}x${height}`);
  }
  if (!(Number.isFinite(maxEdge) && maxEdge >= 1)) {
    throw new RangeError(`Invalid max edge ${maxEdge}`);
  }

  const longest = Math.max(width, height);
  if (longest <= maxEdge) {
    return { width: Math.round(width), height: Math.round(height) };
  }
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}
