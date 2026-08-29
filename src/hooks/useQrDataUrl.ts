"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function useQrDataUrl(content: string | null): string | null {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [renderedFor, setRenderedFor] = useState<string | null>(null);

  // Reset synchronously during render when the target content changes, rather than in an
  // effect body (see https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes).
  if (content !== renderedFor) {
    setRenderedFor(content);
    setDataUrl(null);
  }

  useEffect(() => {
    let cancelled = false;
    if (!content) return;
    QRCode.toDataURL(content, { margin: 1, width: 160 })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [content]);

  return dataUrl;
}
