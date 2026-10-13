import { type RefObject, useLayoutEffect, useRef, useState } from 'react';

/**
 * Measures how wide an element is on screen and keeps the answer current while the
 * window is resized. Returns the ref to hand to that element (a `<div>` that is always
 * drawn), and its width in whole pixels (0 until it has been measured).
 *
 * The first measurement is taken before the browser paints (a layout effect), so the
 * page is never seen at a size worked out from "0 wide". After that a ResizeObserver
 * reports every change of the element's size, whatever caused it.
 * What could go wrong: only use it on an element whose width does not depend on what is
 * drawn with the answer, or measuring and drawing would chase each other.
 */
export function useWidthOfElement(): {
  elementToMeasureRef: RefObject<HTMLDivElement | null>;
  widthInPixels: number;
} {
  const elementToMeasureRef = useRef<HTMLDivElement>(null);
  const [widthInPixels, setWidthInPixels] = useState(0);

  useLayoutEffect(() => {
    const elementToMeasure = elementToMeasureRef.current;
    if (elementToMeasure === null) {
      return;
    }
    const measuredElement = elementToMeasure;

    function measureTheElement(): void {
      setWidthInPixels(measuredElement.clientWidth);
    }

    measureTheElement();
    const resizeObserver = new ResizeObserver(measureTheElement);
    resizeObserver.observe(measuredElement);
    return () => resizeObserver.disconnect();
  }, []);

  return { elementToMeasureRef, widthInPixels };
}
