// Test support: counts how many times each field row of a generated form is drawn
// (BAJAOVRLAY-45). Every field row starts with its field's label, drawn with the ui
// Label, once per draw of the row, and a row skipped by React draws no Label. So a test
// that puts this file in place of the ui Label counts the row draws by the label's text:
//   vi.mock('@/components/ui/label', () => import('./labelDrawCounter.testSupport'));
// The stand-in draws a plain <label> with the same props: the ui Label is Radix's label,
// which adds nothing a test reads (it only stops a double-click from selecting the text).
//
// What could go wrong: the count lives in this module, so it is shared by every test of
// a file. Each test calls startCountingLabelDraws() in its Arrange step, after the page is
// drawn, and reads only what happened after that call.
import type { ComponentProps } from 'react';

const drawsByLabelText = new Map<string, number>();

/** Forgets every draw counted so far: what is read from now on happened after this call. */
export function startCountingLabelDraws(): void {
  drawsByLabelText.clear();
}

/** How many times a Label with exactly this text was drawn since startCountingLabelDraws. */
export function countDrawsOfLabel(labelText: string): number {
  return drawsByLabelText.get(labelText) ?? 0;
}

/**
 * The draws counted for each of these labels, in their order, as one object: easy to
 * compare whole in an assertion, with every label named in the failure.
 */
export function countDrawsOfEachLabel(labelTexts: string[]): Record<string, number> {
  const drawsOfEach: Record<string, number> = {};
  for (const labelText of labelTexts) {
    drawsOfEach[labelText] = countDrawsOfLabel(labelText);
  }
  return drawsOfEach;
}

/** Stands in for the ui Label, counting each draw under its text when it is plain text. */
export function Label(props: ComponentProps<'label'>) {
  if (typeof props.children === 'string') {
    const drawsSoFar = drawsByLabelText.get(props.children) ?? 0;
    drawsByLabelText.set(props.children, drawsSoFar + 1);
  }
  return <label data-slot="label" {...props} />;
}
