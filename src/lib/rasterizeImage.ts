/**
 * @react-pdf/renderer's <Image> only understands JPEG/PNG — it silently renders nothing
 * for SVG or WebP (both of which the logo uploader accepts, since they're fine for the
 * HTML preview's <img>). This redraws whatever image is at `url` onto an offscreen canvas
 * and re-encodes it as PNG, so the exported/shared PDF always gets a format react-pdf can
 * actually embed, regardless of what the logo was originally uploaded as.
 *
 * Browser-only. Returns null (rather than throwing) on any failure — e.g. a CORS-blocked
 * fetch — so a broken logo never blocks the rest of the PDF from generating.
 */
export function toPngDataUrl(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx || canvas.width === 0 || canvas.height === 0) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}
