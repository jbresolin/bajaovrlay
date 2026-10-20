// Motion demo for the "placar" direction, loaded by motion-demo.html (which generatePages.mjs
// writes). Web Animations API only; every duration, lead, stagger and easing is read from
// tokens.css so the demo and motion.md cannot drift apart (the only numbers of this file's own
// are the pauses between steps). The sequence loops, from the sample's order every time:
// tower set in → flag change → positions 3 and 4 trade places → positions 1 and 2 trade
// places (a new leader) → flag back → tower set out → strip set in → two page changes →
// strip set out.
const rootStyle = getComputedStyle(document.documentElement);
const readMs = (token) => Number.parseFloat(rootStyle.getPropertyValue(token));
const readEase = (token) => rootStyle.getPropertyValue(token).trim();
const timing = {
  in: readMs('--motion-in'),
  out: readMs('--motion-out'),
  swap: readMs('--motion-swap'),
  flag: readMs('--motion-flag'),
  stripPage: readMs('--motion-strip-page'),
  stripHold: readMs('--motion-strip-hold'),
  rowStagger: readMs('--motion-row-stagger'),
  cueHold: readMs('--motion-cue-hold'),
  lead: readMs('--motion-lead'),
  bugLead: readMs('--motion-bug-lead'),
  outStagger: readMs('--motion-out-stagger'),
};
const easing = { out: readEase('--ease-out'), in: readEase('--ease-in'), inOut: readEase('--ease-in-out') };

const stepLabel = document.getElementById('demo-step');
const towerSet = document.querySelector('[data-demo="tower-set"]');
const stripSet = document.querySelector('[data-demo="strip-set"]');
const hidden = 'inset(0 100% 0 0)';
const shown = 'inset(0 0 0 0)';
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function hideNow(element) { element.style.clipPath = hidden; }
function wipeIn(element, delay = 0) {
  return element.animate([{ clipPath: hidden }, { clipPath: shown }], { duration: timing.in, easing: easing.out, delay, fill: 'both' }).finished;
}
function wipeOut(element, delay = 0) {
  return element.animate([{ clipPath: shown }, { clipPath: hidden }], { duration: timing.out, easing: easing.in, delay, fill: 'both' }).finished;
}

// The tower wipes in piece by piece: the header is piece 0 and starts one lead (80ms) after the
// clock; row n (counting from 0) is piece n + 1 and starts at lead + stagger × (n + 1), so with
// 24 rows the last starts at 80 + 24 × 18 = 512ms and is in at 772ms (motion.md says the same).
function towerPieces() {
  const tower = towerSet.querySelector('.tower');
  return [tower.querySelector('.tower__header'), ...tower.querySelectorAll('.tower-row')];
}

async function towerSetIn() {
  stepLabel.textContent = 'entrada: wipe da esquerda, 260 ms, linhas em cascata de 18 ms';
  const clock = towerSet.querySelector('.race-clock');
  const bug = towerSet.querySelector('.sponsor-bug');
  const pieces = towerPieces();
  towerSet.style.visibility = 'visible';
  await Promise.all([
    wipeIn(clock),
    wipeIn(bug, timing.bugLead),
    ...pieces.map((piece, index) => wipeIn(piece, timing.lead + index * timing.rowStagger)),
  ]);
}

async function towerSetOut() {
  stepLabel.textContent = 'saída: wipe de volta para a esquerda, 200 ms';
  const clock = towerSet.querySelector('.race-clock');
  const bug = towerSet.querySelector('.sponsor-bug');
  const pieces = towerPieces();
  await Promise.all([
    wipeOut(clock),
    wipeOut(bug),
    ...pieces.map((piece, index) => wipeOut(piece, index * timing.outStagger)),
  ]);
  towerSet.style.visibility = 'hidden';
}

// Flag change: the new band wipes in from the left over the old one, then replaces it.
async function changeFlag(templateId) {
  stepLabel.textContent = 'troca de bandeira: a nova faixa entra por cima, 300 ms';
  const slot = towerSet.querySelector('.race-clock__flag');
  const oldBand = slot.querySelector('.flag-band');
  const newBand = document.getElementById(templateId).content.firstElementChild.cloneNode(true);
  hideNow(newBand);
  slot.appendChild(newBand);
  await newBand.animate([{ clipPath: hidden }, { clipPath: shown }], { duration: timing.flag, easing: easing.out, fill: 'both' }).finished;
  oldBand.remove();
}

// The leader's green cell follows the slot that reads "1", like the position numbers do.
function markLeaderBySlot(row) {
  const isLeader = row.querySelector('.tower-row__position').textContent.trim() === '1';
  if (isLeader) row.setAttribute('data-leader', '');
  else row.removeAttribute('data-leader');
}

function showCue(row, cueClass, templateId) {
  row.classList.add(cueClass);
  row.querySelector('.tower-row__cue').appendChild(document.getElementById(templateId).content.firstElementChild.cloneNode(true));
}

function clearCues(row) {
  row.classList.remove('is-up', 'is-down', 'is-new-leader');
  row.querySelector('.cue')?.remove();
}

// Position change (FLIP): the two rows trade places in the DOM, the position numbers stay
// with the slots, and each row slides from where it was to where it now is. The car that
// moved up gets the ▲ in its cue lane (green), the one that moved down the ▼ (blue); a new
// leader also has its car-number cell flashed to the lighter navy for the same 2 s.
async function swapRows(upperIndex) {
  const isLeaderSwap = upperIndex === 0;
  stepLabel.textContent = isLeaderSwap
    ? 'novo líder: deslize 400 ms, seta e célula do número em destaque por 2 s'
    : 'troca de posição: linhas deslizam 400 ms, seta por 2 s';
  const list = towerSet.querySelector('.tower__rows');
  const rows = [...list.querySelectorAll('.tower-row')];
  const upper = rows[upperIndex];
  const lower = rows[upperIndex + 1];
  const upperTopBefore = upper.getBoundingClientRect().top;
  const lowerTopBefore = lower.getBoundingClientRect().top;

  list.insertBefore(lower, upper);
  const upperPositionCell = upper.querySelector('.tower-row__position');
  const lowerPositionCell = lower.querySelector('.tower-row__position');
  const upperNumber = upperPositionCell.textContent;
  upperPositionCell.textContent = lowerPositionCell.textContent;
  lowerPositionCell.textContent = upperNumber;
  markLeaderBySlot(upper);
  markLeaderBySlot(lower);

  const upperShift = upperTopBefore - upper.getBoundingClientRect().top;
  const lowerShift = lowerTopBefore - lower.getBoundingClientRect().top;
  const slide = (row, shift) =>
    row.animate([{ transform: `translateY(${shift}px)` }, { transform: 'translateY(0)' }], { duration: timing.swap, easing: easing.inOut }).finished;

  showCue(lower, 'is-up', 'cue-up');
  showCue(upper, 'is-down', 'cue-down');
  if (isLeaderSwap) lower.classList.add('is-new-leader');

  await Promise.all([slide(upper, upperShift), slide(lower, lowerShift)]);
  await wait(timing.cueHold - timing.swap);
  clearCues(upper);
  clearCues(lower);
}

// The lower third enters in two pieces, the name plate first and the role row one lead (80ms)
// behind it (motion.md "In and out, per graphic"); when it enters with the strip, the name
// plate itself starts one lead after the strip, so the strip leads. Both pieces leave together.

function lowerThirdPieces() {
  const lowerThird = stripSet.querySelector('.lower-third');
  return [lowerThird.querySelector('.lower-third__name'), lowerThird.querySelector('.lower-third__row')];
}

async function stripSetIn() {
  stepLabel.textContent = 'faixa inferior e terço: wipe da esquerda, 260 ms, o terço em duas peças';
  const [namePlate, roleRow] = lowerThirdPieces();
  stripSet.style.visibility = 'visible';
  await Promise.all([
    wipeIn(stripSet.querySelector('.lower-strip')),
    wipeIn(namePlate, timing.lead),
    wipeIn(roleRow, timing.lead * 2),
  ]);
}

async function stripSetOut() {
  stepLabel.textContent = 'saída da faixa: wipe de volta, 200 ms';
  await Promise.all([wipeOut(stripSet.querySelector('.lower-strip')), ...lowerThirdPieces().map((piece) => wipeOut(piece))]);
  stripSet.style.visibility = 'hidden';
}

// Strip page change: the next page wipes in over the current one in 150ms; the page stays
// still for 7s between changes (the demo shortens the hold so the loop stays watchable).
async function stripTurnPage(templateId, pageNumber) {
  stepLabel.textContent = `faixa: página ${pageNumber}, corte seco com wipe de 150 ms`;
  const pages = stripSet.querySelector('.lower-strip__pages');
  const oldPage = pages.querySelector('.lower-strip__cars');
  const newPage = document.getElementById(templateId).content.firstElementChild.cloneNode(true);
  hideNow(newPage);
  pages.appendChild(newPage);
  await newPage.animate([{ clipPath: hidden }, { clipPath: shown }], { duration: timing.stripPage, easing: 'linear', fill: 'both' }).finished;
  oldPage.remove();
  const indicator = stripSet.querySelector('.lower-strip__page-indicator');
  indicator.textContent = indicator.textContent.replace(/^\d+/, String(pageNumber));
}

// The two swaps leave the tower in a different order from the sample's, so every pass starts
// by putting the rows back as the page was written (car 31 leads, car 38 second, car 25
// third...) and every pass tells the same story.
const rowsAsWritten = [...towerSet.querySelectorAll('.tower-row')];
const positionsAsWritten = rowsAsWritten.map((row) => row.querySelector('.tower-row__position').textContent);

function restoreSampleOrder() {
  const list = towerSet.querySelector('.tower__rows');
  rowsAsWritten.forEach((row, index) => {
    list.appendChild(row);
    row.querySelector('.tower-row__position').textContent = positionsAsWritten[index];
    clearCues(row);
    markLeaderBySlot(row);
  });
}

async function runLoop() {
  const demoHold = Math.min(timing.stripHold, 3000);
  for (;;) {
    restoreSampleOrder();
    for (const element of [towerSet.querySelector('.race-clock'), towerSet.querySelector('.sponsor-bug'), ...towerPieces()]) hideNow(element);
    for (const element of [stripSet.querySelector('.lower-strip'), ...lowerThirdPieces()]) hideNow(element);
    await towerSetIn();
    await wait(1600);
    await changeFlag('yellow-flag-band');
    await wait(1200);
    await swapRows(2);
    await wait(800);
    await swapRows(0);
    await wait(800);
    await changeFlag('green-flag-band');
    await wait(1200);
    await towerSetOut();
    await wait(500);
    await stripSetIn();
    await wait(demoHold);
    await stripTurnPage('strip-page-two', 2);
    await wait(demoHold);
    await stripTurnPage('strip-page-one', 1);
    await wait(demoHold);
    await stripSetOut();
    await wait(800);
  }
}

towerSet.style.visibility = 'hidden';
stripSet.style.visibility = 'hidden';
document.fonts.ready.then(runLoop);
