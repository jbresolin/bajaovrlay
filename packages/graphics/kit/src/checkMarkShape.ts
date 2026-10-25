/**
 * The check mark as an SVG path for a 20 × 20 viewBox, the design's (docs/design/tools/
 * slateVocabulary.mjs): the sessions board's finished slot and the bracket's winner of a
 * match with no number (BAJAOVRLAY-25). A shape, never a glyph, so it reads at any size
 * and the layout checker never takes it for small text. The graphic puts it inside its own
 * `<svg class="…" viewBox="0 0 20 20">`, sized by its own styles.
 */
import { svg } from 'lit';

export const checkMarkShape = svg`<path d="M3.5 10.5 8 15 16.5 5.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />`;
