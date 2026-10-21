// The words and icons every slate page shares: the flag words and their sheet labels, the
// three status icons (shape carries the meaning: a P in a square for the pit, a wrench for a
// broken car, a circle with a slash for a retired one) and the HTML escaper. Data, not markup, so
// slateTemplates.mjs stays the one place that writes HTML.
import { readFileSync } from 'node:fs';

const sampleDataUrl = new URL('../sample-data.json', import.meta.url);
export const sample = JSON.parse(readFileSync(sampleDataUrl, 'utf8'));

// Flag words beyond the two in sample-data.json come from the product's own pt-BR catalogue
// (packages/graphics/race-clock/src/ptBR.ts), so the sheet shows the words that go on air.
export const flagWords = {
  pre: 'PRÉ-LARGADA',
  green: sample.session.flagLabel,
  yellow: sample.sessionYellow.flagLabel,
  red: 'VERMELHA',
  checkered: 'QUADRICULADA',
  finished: 'ENCERRADA',
};
export const flagOrder = ['pre', 'green', 'yellow', 'red', 'checkered', 'finished'];
export const flagStateLabels = {
  pre: 'antes da largada',
  green: 'bandeira verde',
  yellow: 'bandeira amarela',
  red: 'bandeira vermelha',
  checkered: 'bandeira quadriculada',
  finished: 'prova encerrada',
};

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Status icons: inline SVG, three different shapes, paths only (no <text>), so the glyph stays
// a glyph and the layout checker never reads it as small text.
export const statusIcons = {
  inPit: `<svg class="status-icon" viewBox="0 0 20 20" role="img" aria-label="No box"><rect x="1.5" y="1.5" width="17" height="17" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M7.25 14.75V5.25h3.25a2.6 2.6 0 0 1 0 5.2H7.25" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  stopped: `<svg class="status-icon" viewBox="0 0 20 20" role="img" aria-label="Quebrado"><path d="M14.5 2.2a4.3 4.3 0 0 0-5.3 5.9L2.7 14.6a1.9 1.9 0 1 0 2.7 2.7l6.5-6.5a4.3 4.3 0 0 0 5.9-5.3l-2.6 2.6-2.4-.9-.9-2.4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`,
  retired: `<svg class="status-icon" viewBox="0 0 20 20" role="img" aria-label="Abandonou"><circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4.6 15.4 15.4 4.6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`,
};
export const statusShapeWords = {
  inPit: 'um P num quadrado',
  stopped: 'uma chave inglesa',
  retired: 'um círculo cortado',
};
export const largeIcon = (status) =>
  statusIcons[status].replace('class="status-icon"', 'class="status-icon status-icon--large"');
