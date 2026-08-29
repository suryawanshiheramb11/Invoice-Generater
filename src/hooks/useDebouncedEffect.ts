import { useEffect, useRef } from "react";

/** Runs `effect` `delay`ms after the last change to `deps`, skipping the very first render. */
export function useDebouncedEffect(effect: () => void, deps: unknown[], delay: number) {
  const isFirst = useRef(true);

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    const handle = setTimeout(effect, delay);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
