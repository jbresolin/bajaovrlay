// Test support: counts how many times a ui component is drawn, by the text it shows
// (BAJAOVRLAY-38). A Camadas row draws its "Limpar" button once per draw of the row, and
// the chip "item mudou" draws its Badge once per draw of the chip, so a test that puts a
// counting stand-in in place of ActionButton and Badge counts the row's and the chip's
// draws by those texts:
//   vi.mock('@/components/ui/badge', async (importOriginal) => {
//     const badge = await importOriginal<typeof import('@/components/ui/badge')>();
//     return { ...badge, Badge: wrapComponentCountingDrawsByText(badge.Badge) };
//   });
// The stand-in draws the real component with the same props, so nothing else changes.
//
// What could go wrong: the count lives in this module, so it is shared by every test of
// a file. Each test calls startCountingDrawsByText() in its Arrange step, after the page is
// drawn, and reads only what happened after that call.
import type { ComponentType, ReactNode } from 'react';

const drawsByText = new Map<string, number>();

/** Forgets every draw counted so far: what is read from now on happened after this call. */
export function startCountingDrawsByText(): void {
  drawsByText.clear();
}

/** How many times a counted component with exactly this text was drawn since the start. */
export function countDrawsOfText(text: string): number {
  return drawsByText.get(text) ?? 0;
}

/** Counts one draw under the component's text, when its children are plain text. */
function countOneDraw(children: ReactNode): void {
  if (typeof children !== 'string') {
    return;
  }
  const drawsSoFar = drawsByText.get(children) ?? 0;
  drawsByText.set(children, drawsSoFar + 1);
}

/**
 * The component, drawn as it is, counting each of its draws under its text. Used for the
 * ui Badge and ActionButton, which are never memoised, so a draw of the stand-in is a
 * draw of what holds it.
 */
export function wrapComponentCountingDrawsByText<Props extends { children?: ReactNode }>(
  Component: ComponentType<Props>,
): ComponentType<Props> {
  function ComponentThatCountsItsDraws(props: Props) {
    countOneDraw(props.children);
    return <Component {...props} />;
  }
  return ComponentThatCountsItsDraws;
}
