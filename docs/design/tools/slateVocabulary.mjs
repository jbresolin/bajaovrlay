// The words and icons every slate page shares: the flag words and their sheet labels, the
// three status icons (shape carries the meaning: a P in a square for the pit, a wrench for a
// broken car, a circle with a slash for a retired one), the catalogue's icons (a warning
// triangle, the schedule's three states, the battle card's trend) and the placeholder mark
// that stands in for a logo, plus the HTML escaper. Data, not page markup, so the builders
// stay the places that write pages.
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

// A notice from race direction carries a warning triangle: a shape, never a flag colour, so a
// penalty on air is not mistaken for the clock's flag band.
export const warningIcon = `<svg class="status-icon" viewBox="0 0 20 20" role="img" aria-label="Aviso"><path d="M10 2.4 18.6 17.2H1.4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M10 7.6v4.2" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="10" cy="14.4" r="1.2" fill="currentColor"/></svg>`;

// The schedule's three states, each a different shape beside its word: a check mark for a
// slot that ended, a play triangle for the one in progress, a hollow circle for one to come.
export const scheduleIcons = {
  done: `<svg class="status-icon" viewBox="0 0 20 20" role="img" aria-label="Concluída"><path d="M3.5 10.5 8 15 16.5 5.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  live: `<svg class="status-icon" viewBox="0 0 20 20" role="img" aria-label="Em andamento"><path d="M5 3.5v13l11-6.5z" fill="currentColor"/></svg>`,
  next: `<svg class="status-icon" viewBox="0 0 20 20" role="img" aria-label="A seguir"><circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>`,
};

// The battle card's trend beside its word: two arrows closing on each other when the gap
// shrinks, opening out when it grows, a dash when it holds.
export const trendIcons = {
  closing: `<svg viewBox="0 0 24 10" aria-hidden="true"><path d="M0 0l9 5-9 5z" fill="currentColor"/><path d="M24 0l-9 5 9 5z" fill="currentColor"/></svg>`,
  opening: `<svg viewBox="0 0 24 10" aria-hidden="true"><path d="M9 0 0 5l9 5z" fill="currentColor"/><path d="M15 0l9 5-9 5z" fill="currentColor"/></svg>`,
  steady: `<svg viewBox="0 0 24 10" aria-hidden="true"><rect x="2" y="4" width="20" height="2" fill="currentColor"/></svg>`,
};

/**
 * A placeholder mark where a logo will go (a sponsor, a team): a ring with initials, drawn
 * in the text colour. Never a real brand; the entity library brings the real artwork.
 */
export function placeholderMark(initials, label) {
  return `<svg class="sponsor-mark" viewBox="0 0 48 48" role="img" aria-label="${escapeHtml(label)}"><circle cx="24" cy="24" r="21" fill="none" stroke="currentColor" stroke-width="2.5"/><text x="24" y="31.5" text-anchor="middle" font-size="22" font-family="Bebas Neue, sans-serif" fill="currentColor">${escapeHtml(initials)}</text></svg>`;
}
