// Motion demo shared by the slate directions, loaded by each motion-demo.html. Web Animations
// API only; every duration, offset, stagger and easing is read from the direction's tokens.css,
// so the demo and its motion.md cannot drift apart (the only numbers of this file's own are
// the pauses between steps). The loop, from the sample's order every time: tower set in →
// flag change → positions 3 and 4 trade places → positions 1 and 2 trade places (a new
// leader) → flag back → tower set out → strip set in → two page changes → strip set out.
const rootStyle = getComputedStyle(document.documentElement);
const readMs = (token) => Number.parseFloat(rootStyle.getPropertyValue(token));
const readNumber = (token) => Number.parseFloat(rootStyle.getPropertyValue(token));
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
};
const offsetPx = readNumber('--motion-in-offset');
const inScale = readNumber('--motion-in-scale');
const easing = { out: readEase('--ease-out'), in: readEase('--ease-in'), inOut: readEase('--ease-in-out') };

const stepLabel = document.getElementById('demo-step');
const towerSet = document.querySelector('[data-demo="tower-set"]');
const stripSet = document.querySelector('[data-demo="strip-set"]');
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// In: the piece rises into place (the scoreboard's slide-in) and fades up, scaling from
// --motion-in-scale when the direction wants chips to "pop". Out: it fades and lifts away.
const hiddenFrame = { opacity: 0, transform: `translateY(${offsetPx}px) scale(${inScale})` };
const shownFrame = { opacity: 1, transform: 'translateY(0) scale(1)' };
const goneFrame = { opacity: 0, transform: `translateY(${-offsetPx}px) scale(1)` };
function hideNow(element) { element.style.opacity = '0'; }
function slideIn(element, delay = 0) {
  return element.animate([hiddenFrame, shownFrame], { duration: timing.in, easing: easing.out, delay, fill: 'both' }).finished;
}
function slideOut(element, delay = 0) {
  return element.animate([shownFrame, goneFrame], { duration: timing.out, easing: easing.in, delay, fill: 'both' }).finished;
}

function towerPieces() {
  const tower = towerSet.querySelector('.tower');
  return [tower.querySelector('.tower__head'), ...tower.querySelectorAll('.row')];
}

async function towerSetIn() {
  stepLabel.textContent = `entrada: cada peça sobe e aparece em ${timing.in} ms, linhas em cascata de ${timing.rowStagger} ms`;
  const clock = towerSet.querySelector('.race-clock');
  const bug = towerSet.querySelector('.sponsor-bug');
  towerSet.style.visibility = 'visible';
  await Promise.all([
    slideIn(clock),
    slideIn(bug, timing.lead),
    ...towerPieces().map((piece, index) => slideIn(piece, timing.lead + index * timing.rowStagger)),
  ]);
}

async function towerSetOut() {
  stepLabel.textContent = `saída: tudo some para cima em ${timing.out} ms`;
  const clock = towerSet.querySelector('.race-clock');
  const bug = towerSet.querySelector('.sponsor-bug');
  await Promise.all([slideOut(clock), slideOut(bug), ...towerPieces().map((piece) => slideOut(piece))]);
  towerSet.style.visibility = 'hidden';
}

// Flag change: the new band fades in over the old one (the colour crossfades, the word with
// it), then replaces it.
async function changeFlag(templateId) {
  stepLabel.textContent = `troca de bandeira: a nova cor entra por cima em ${timing.flag} ms`;
  const oldBand = towerSet.querySelector('.race-clock__flag');
  const newBand = document.getElementById(templateId).content.firstElementChild.cloneNode(true);
  newBand.style.position = 'absolute';
  newBand.style.left = '0';
  newBand.style.right = '0';
  newBand.style.bottom = '0';
  newBand.style.opacity = '0';
  oldBand.parentElement.appendChild(newBand);
  await newBand.animate([{ opacity: 0 }, { opacity: 1 }], { duration: timing.flag, easing: easing.out, fill: 'both' }).finished;
  oldBand.remove();
  newBand.style.position = '';
  newBand.style.left = '';
  newBand.style.right = '';
  newBand.style.bottom = '';
}

function markLeaderBySlot(row) {
  const isLeader = row.querySelector('.row__pos').textContent.trim() === '1';
  if (isLeader) row.setAttribute('data-leader', '');
  else row.removeAttribute('data-leader');
}

function showCue(row, cueClass, templateId) {
  row.classList.add(cueClass);
  row.querySelector('.row__cue').appendChild(document.getElementById(templateId).content.firstElementChild.cloneNode(true));
}

function clearCues(row) {
  row.classList.remove('is-up', 'is-down');
  row.querySelector('.cue')?.remove();
}

// Position change (FLIP): the two rows trade places in the DOM, the position numbers stay
// with the slots, and each pill slides from where it was to where it now is. The car that
// moved up gets the ▲ and its position cell in the "up" colour; the other the ▼, for 2 s.
async function swapRows(upperIndex) {
  stepLabel.textContent = upperIndex === 0
    ? `novo líder: as pílulas trocam de lugar em ${timing.swap} ms, seta por ${timing.cueHold / 1000} s`
    : `troca de posição: as pílulas deslizam em ${timing.swap} ms, seta por ${timing.cueHold / 1000} s`;
  const list = towerSet.querySelector('.tower__rows');
  const rows = [...list.querySelectorAll('.row')];
  const upper = rows[upperIndex];
  const lower = rows[upperIndex + 1];
  const upperTopBefore = upper.getBoundingClientRect().top;
  const lowerTopBefore = lower.getBoundingClientRect().top;

  list.insertBefore(lower, upper);
  const upperCell = upper.querySelector('.row__pos');
  const lowerCell = lower.querySelector('.row__pos');
  const upperNumber = upperCell.textContent;
  upperCell.textContent = lowerCell.textContent;
  lowerCell.textContent = upperNumber;
  markLeaderBySlot(upper);
  markLeaderBySlot(lower);

  const upperShift = upperTopBefore - upper.getBoundingClientRect().top;
  const lowerShift = lowerTopBefore - lower.getBoundingClientRect().top;
  const slide = (row, shift) =>
    row.animate([{ transform: `translateY(${shift}px)` }, { transform: 'translateY(0)' }], { duration: timing.swap, easing: easing.inOut }).finished;

  showCue(lower, 'is-up', 'cue-up');
  showCue(upper, 'is-down', 'cue-down');
  await Promise.all([slide(upper, upperShift), slide(lower, lowerShift)]);
  await wait(timing.cueHold - timing.swap);
  clearCues(upper);
  clearCues(lower);
}

function lowerThirdPieces() {
  const lowerThird = stripSet.querySelector('.lower-third');
  return [lowerThird.querySelector('.lower-third__name'), lowerThird.querySelector('.lower-third__role')];
}

function stripPieces() {
  const strip = stripSet.querySelector('.lower-strip');
  return [strip.querySelector('.lower-strip__clock'), ...strip.querySelectorAll('.strip-car'), strip.querySelector('.lower-strip__page')];
}

async function stripSetIn() {
  stepLabel.textContent = `faixa inferior e terço: as pílulas sobem em cascata de ${timing.rowStagger} ms`;
  const [namePill, rolePill] = lowerThirdPieces();
  stripSet.style.visibility = 'visible';
  await Promise.all([
    ...stripPieces().map((piece, index) => slideIn(piece, index * timing.rowStagger)),
    slideIn(namePill, timing.lead),
    slideIn(rolePill, timing.lead * 2),
  ]);
}

async function stripSetOut() {
  stepLabel.textContent = `saída da faixa e do terço em ${timing.out} ms`;
  await Promise.all([...stripPieces().map((piece) => slideOut(piece)), ...lowerThirdPieces().map((piece) => slideOut(piece))]);
  stripSet.style.visibility = 'hidden';
}

// Strip page change: the old page's pills lift away and the new page's pills rise in, each
// with the row stagger; the page stays still for --motion-strip-hold between changes (the
// demo shortens that hold so the loop stays watchable).
async function stripTurnPage(templateId, pageNumber) {
  stepLabel.textContent = `faixa: página ${pageNumber}, pílulas trocam em ${timing.stripPage} ms`;
  const pages = stripSet.querySelector('.lower-strip__pages');
  const oldPage = pages.querySelector('.lower-strip__cars');
  const newPage = document.getElementById(templateId).content.firstElementChild.cloneNode(true);
  const newCars = [...newPage.querySelectorAll('.strip-car')];
  newCars.forEach(hideNow);
  pages.appendChild(newPage);
  const oldCars = [...oldPage.querySelectorAll('.strip-car')];
  await Promise.all([
    ...oldCars.map((car, index) => car.animate([shownFrame, goneFrame], { duration: timing.stripPage, easing: easing.in, delay: index * (timing.rowStagger / 2), fill: 'both' }).finished),
    ...newCars.map((car, index) => car.animate([hiddenFrame, shownFrame], { duration: timing.stripPage, easing: easing.out, delay: index * (timing.rowStagger / 2), fill: 'both' }).finished),
  ]);
  oldPage.remove();
  const indicator = stripSet.querySelector('.lower-strip__page');
  indicator.textContent = indicator.textContent.replace(/^\d+/, String(pageNumber));
}

// The two swaps leave the tower in another order than the sample's, so every pass starts by
// putting the rows back as the page was written and tells the same story.
const rowsAsWritten = [...towerSet.querySelectorAll('.row')];
const positionsAsWritten = rowsAsWritten.map((row) => row.querySelector('.row__pos').textContent);

function restoreSampleOrder() {
  const list = towerSet.querySelector('.tower__rows');
  rowsAsWritten.forEach((row, index) => {
    list.appendChild(row);
    row.querySelector('.row__pos').textContent = positionsAsWritten[index];
    clearCues(row);
    markLeaderBySlot(row);
  });
}

async function runLoop() {
  const demoHold = Math.min(timing.stripHold, 3000);
  for (;;) {
    restoreSampleOrder();
    for (const element of [towerSet.querySelector('.race-clock'), towerSet.querySelector('.sponsor-bug'), ...towerPieces()]) hideNow(element);
    for (const element of [...stripPieces(), ...lowerThirdPieces()]) hideNow(element);
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
