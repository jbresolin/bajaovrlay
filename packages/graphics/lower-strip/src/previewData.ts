/**
 * Chooses what preview.html shows: the JSON in `?data=` when there is one, or the real
 * enduro's 34 cars (realEnduroField.ts) with the race clock an hour in under the green
 * flag, counting from the moment the page opened, and the clock block unless the address
 * says `?clock=off`. Three more switches show the looks of BAJAOVRLAY-81: `?flag=off` (no
 * flag), `?laps=on` (each car's laps) and `?gap=laps|lapsAndTime|time` (the gap). Whether the data is valid is left to the graphic's own load(), so the
 * preview shows exactly the answer a renderer would get. The stage behind it is the kit's
 * `?stage=grey|black`.
 */
import { type LowerStripData, type StripGapDisplay, stripGapDisplays } from './lowerStripModel.js';
import { ptBR } from './ptBR.js';
import { createRealEnduroField } from './realEnduroField.js';

/** Either data to load, or a pt-BR sentence saying why the address could not be read. */
export type PreviewDataChoice =
  { isReadable: true; data: unknown } | { isReadable: false; problem: string };

/** The time the sample's clock reads when the page opens: one hour of racing. */
const sampleClockTimeMs = 3_600_000;

/** What the sample shows besides the cars and the clock; the address sets each. */
export type RealEnduroStripSampleOptions = {
  openedAtMs: number;
  isClockBlockShown: boolean;
  isClockRunning: boolean;
  /** False for `?flag=off`: the strip with no flag (BAJAOVRLAY-81). */
  isFlagShown: boolean;
  /** True for `?laps=on`: each car shows its laps. */
  isLapsShown: boolean;
  /** `?gap=...`: how each car shows its gap to the leader; "none" without it. */
  gapDisplay: StripGapDisplay;
};

/**
 * Builds the real enduro an hour in: 34 cars, the clock running from 1:00:00 at
 * `openedAtMs` under the green flag (or none), the block, the laps and the gap as asked.
 * The clock is held at the reading for `?stage=` screenshots, so a baseline never depends
 * on how long a page took. The laps and gap switches are written only when asked for, so
 * the everyday sample is exactly the one before BAJAOVRLAY-81.
 */
export function createRealEnduroStripSample(options: RealEnduroStripSampleOptions): LowerStripData {
  const sample: LowerStripData = {
    entries: createRealEnduroField(),
    clockMode: 'elapsed',
    referenceTimeMs: sampleClockTimeMs,
    referenceWallClockMs: options.openedAtMs,
    running: options.isClockRunning,
    showClockBlock: options.isClockBlockShown,
  };
  if (options.isFlagShown) {
    sample.state = 'green';
  }
  if (options.isLapsShown) {
    sample.showLaps = true;
  }
  if (options.gapDisplay !== 'none') {
    sample.gapDisplay = options.gapDisplay;
  }
  return sample;
}

/** Reads `?gap=` as one of the gap displays; anything else (or nothing) is "none". */
function readGapDisplayOfAddress(gapText: string | null): StripGapDisplay {
  const matchingDisplay = stripGapDisplays.find((gapDisplay) => gapDisplay === gapText);
  return matchingDisplay ?? 'none';
}

/** Reads the data from an address query string (location.search); never throws. */
export function choosePreviewData(addressQuery: string, openedAtMs: number): PreviewDataChoice {
  const searchParameters = new URLSearchParams(addressQuery);
  const dataText = searchParameters.get('data');
  if (dataText === null) {
    const isScreenshotStage = searchParameters.has('stage');
    const data = createRealEnduroStripSample({
      openedAtMs,
      isClockBlockShown: searchParameters.get('clock') !== 'off',
      isClockRunning: !isScreenshotStage,
      isFlagShown: searchParameters.get('flag') !== 'off',
      isLapsShown: searchParameters.get('laps') === 'on',
      gapDisplay: readGapDisplayOfAddress(searchParameters.get('gap')),
    });
    return { isReadable: true, data };
  }

  try {
    const data: unknown = JSON.parse(dataText);
    return { isReadable: true, data };
  } catch {
    return { isReadable: false, problem: ptBR.preview.unreadableAddressData };
  }
}
