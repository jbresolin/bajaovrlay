// Assembles every page of a slate direction from the on-air builders (slateTemplates.mjs) and
// the reference sheets (slateSheets.mjs): a direction's generatePages.mjs calls buildPages()
// with its numbers and writes the result.
import { renderSheetColumns, renderSheetFlags, renderSheetStatus } from './slateSheets.mjs';
import {
  pageShell,
  renderCompactRow,
  renderCompactTower,
  renderDetailedTower,
  renderFlagBand,
  renderLowerStrip,
  renderLowerThird,
  renderRaceClock,
  renderSponsorBug,
  renderStripPage,
  sample,
  setGapUnit,
} from './slateTemplates.mjs';

// ---------------------------------------------------------------- motion demo

function renderMotionDemo(direction, options) {
  const { compactRows, stripCarsPerPage } = options;
  const pageOne = sample.positions.slice(0, stripCarsPerPage);
  const pageTwo = sample.positions.slice(stripCarsPerPage, stripCarsPerPage * 2);
  const pageCount = Math.ceil(sample.positions.length / stripCarsPerPage);
  const body = `<div class="demo-stage" data-demo="tower-set">
${renderRaceClock(sample.session)}
${renderCompactTower(sample.positions.slice(0, compactRows), sample.session)}
${renderSponsorBug(sample.sponsorBug)}
</div>
<div class="demo-stage" data-demo="strip-set">
${renderLowerStrip(pageOne, sample.session, 1, pageCount)}
${renderLowerThird(sample.people[0])}
</div>
<template id="tower-page-1">
${sample.positions.slice(0, compactRows).map(renderCompactRow).join('\n')}
</template>
<template id="tower-page-2">
${sample.positions
  .slice(compactRows, compactRows * 2)
  .map(renderCompactRow)
  .join('\n')}
</template>
<template id="tower-page-3">
${sample.positions
  .slice(compactRows * 2, compactRows * 3)
  .map(renderCompactRow)
  .join('\n')}
</template>
<template id="strip-page-two">
${renderStripPage(pageTwo)}
</template>
<template id="strip-page-one">
${renderStripPage(pageOne)}
</template>
<template id="yellow-flag-band">
${renderFlagBand(sample.sessionYellow.flag, sample.sessionYellow.flagLabel)}
</template>
<template id="green-flag-band">
${renderFlagBand(sample.session.flag, sample.session.flagLabel)}
</template>
<template id="cue-up"><svg class="cue" viewBox="0 0 14 10" aria-hidden="true"><path d="M7 0 14 10H0Z" fill="currentColor"/></svg></template>
<template id="cue-down"><svg class="cue" viewBox="0 0 14 10" aria-hidden="true"><path d="M0 0h14L7 10Z" fill="currentColor"/></svg></template>
<div class="card demo-caption"><span class="caption">demo de movimento</span><span class="demo-caption__step" id="demo-step">…</span></div>`;
  // The demo script is shared by the three directions and reads every timing from tokens.css.
  const script = `<script src="../../tools/slateMotionDemo.js"></script>
`;
  return pageShell(direction, 'motion demo', body, script);
}

// ---------------------------------------------------------------- everything

/**
 * Builds every page of one direction: a map of file name to HTML. Options: name (the folder
 * name), compactRows, detailedRows, stripCarsPerPage, and gapUnit ('s' keeps "+19,0 s",
 * 'none' writes "+19,0" for a caps-only face).
 */
export function buildPages(options) {
  const { name, compactRows, detailedRows, stripCarsPerPage, gapUnit = 's' } = options;
  setGapUnit(gapUnit);
  const compactCars = sample.positions.slice(0, compactRows);
  const detailedCars = sample.positions.slice(0, detailedRows);
  const stripCars = sample.positions.slice(0, stripCarsPerPage);
  const stripPageCount = Math.ceil(sample.positions.length / stripCarsPerPage);
  const shell = (title, body) => pageShell(name, title, body);

  return {
    'race-clock.html': shell('race clock', renderRaceClock(sample.session)),
    'race-clock-sem-bandeira.html': shell(
      'race clock without the flag',
      renderRaceClock(sample.session, sample.session.flag, sample.session.flagLabel, {
        withFlag: false,
      }),
    ),
    'positions-compact.html': shell(
      'positions compact',
      renderCompactTower(compactCars, sample.session),
    ),
    'positions-detailed.html': shell(
      'positions detailed',
      renderDetailedTower(detailedCars, sample.session),
    ),
    'lower-strip.html': shell(
      'lower strip',
      renderLowerStrip(stripCars, sample.session, 1, stripPageCount),
    ),
    'lower-third.html': shell('lower third', renderLowerThird(sample.people[0])),
    'sponsor-bug.html': shell('sponsor bug', renderSponsorBug(sample.sponsorBug)),
    'combo-tower.html': shell(
      'combo tower',
      [
        renderRaceClock(sample.session),
        renderCompactTower(compactCars, sample.session),
        renderSponsorBug(sample.sponsorBug),
      ].join('\n'),
    ),
    'combo-strip.html': shell(
      'combo strip',
      [
        renderLowerStrip(stripCars, sample.session, 1, stripPageCount),
        renderLowerThird(sample.people[0]),
      ].join('\n'),
    ),
    'sheet-flags.html': shell('sheet flags', renderSheetFlags(name)),
    'sheet-status.html': shell('sheet status', renderSheetStatus(name)),
    'sheet-columns.html': shell('sheet columns', renderSheetColumns(name)),
    'motion-demo.html': renderMotionDemo(name, options),
  };
}
