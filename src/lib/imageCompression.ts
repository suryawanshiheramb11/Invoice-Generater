import imageCompression from "browser-image-compression";

/**
 * Downscales/recompresses an image file before it's uploaded to Supabase Storage.
 * Falls back to the original file on any failure (an unusual codec, a worker that
 * can't spin up) -- compression is an optimization, never a hard requirement for
 * the upload to proceed.
 */
export async function compressImage(
  file: File,
  options: { maxSizeMB: number; maxWidthOrHeight: number }
): Promise<File> {
  try {
    return await imageCompression(file, {
      maxSizeMB: options.maxSizeMB,
      maxWidthOrHeight: options.maxWidthOrHeight,
      useWebWorker: true,
      initialQuality: 0.8,
    });
  } catch {
    return file;
  }
}
