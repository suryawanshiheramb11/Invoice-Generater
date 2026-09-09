"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

/** Matches .invoice-page's `width: 210mm` (A4) at 96dpi. */
const PAGE_WIDTH_PX = 794;

/**
 * Shrinks the A4-shaped invoice preview to fit narrow screens by scaling it
 * down visually (like a document viewer), rather than letting it reflow at
 * its own natural width. Reflowing kept the page's fixed padding/font sizes
 * but not its A4 width, so on a phone the content collided with itself —
 * cramped table columns, an overflowing totals box, huge padding eating most
 * of the available space. Scaling keeps the preview pixel-identical to the
 * real PDF at any width.
 */
export function InvoiceScaleFrame({ children }: { children: ReactNode }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [scaledHeight, setScaledHeight] = useState<number>();
  const [offsetX, setOffsetX] = useState(0);

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const page = pageRef.current;
    if (!outer || !page) return;

    const measure = () => {
      const availableWidth = outer.clientWidth;
      const nextScale = availableWidth > 0 ? Math.min(1, availableWidth / PAGE_WIDTH_PX) : 1;
      setScale(nextScale);
      setScaledHeight(page.offsetHeight * nextScale);
      // On wide screens the page renders below its natural 794px width and
      // used to be centered via `mx-auto`; transform-origin: top-left loses
      // that, so re-center by hand. On narrow screens the scaled width fills
      // the available space exactly and this is always 0.
      setOffsetX(Math.max(0, availableWidth - PAGE_WIDTH_PX * nextScale) / 2);
    };

    measure();
    // Two observers: the outer tracks viewport/container width changes, the
    // inner tracks the invoice's own height changing as items are added.
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(outer);
    resizeObserver.observe(page);
    return () => resizeObserver.disconnect();
  }, []);

  return (
    <div ref={outerRef} className="invoice-scale-outer" style={{ height: scaledHeight }}>
      <div
        ref={pageRef}
        className="invoice-scale-inner"
        style={{ width: PAGE_WIDTH_PX, marginLeft: offsetX, "--invoice-scale": scale } as CSSProperties}
      >
        {children}
      </div>
    </div>
  );
}
