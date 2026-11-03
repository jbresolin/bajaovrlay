// The slices a screen is sent. A screen is a renderer page: the program renderer OBS
// loads (`/ws?role=renderer`) or a copy of it the control page frames as its "Programa"
// or "Prévia" monitor (`/ws?role=monitor`). A screen draws four slices and reads no
// other: the layers, the graphics, the instances on air and the layers Prévia shows as
// "vai limpar". So it is sent those four and nothing else (João's ruling at gate 2 of
// PR #17), plus the outputs (BAJAOVRLAY-49): a few rows that change only when the
// operator edits them, sent because the schema requires `program` in that slice, so it
// cannot be sent empty as the others are. An allowlist, not a list of what to hide, so a slice added later reaches the
// screens only when someone decides it should. Two reasons:
//   - graphics receive resolved data only (architecture rule 3), and parsing a 60-car
//     snapshot every two seconds per source is a frame-drop risk inside OBS;
//   - a page opened before an upgrade keeps its old schemas and refuses a hello they
//     refuse (a data source of a kind they do not know, such as `httpJson`); a slice it
//     never receives can never do that.
// Since BAJAOVRLAY-49 a screen draws one output (`&output=pip`, program when left out),
// and of the layers, the instances and the marks it gets only those of that output's
// layers: OBS's PiP source never parses program's graphics, and the renderer stays as
// dumb as it was, drawing whatever it is sent.
// Operator connections (the control page itself) still receive every slice. The hub
// applies this to the hello and to every change; GET /api/v1/state applies it when asked
// with `?role=`. What could go wrong: the role is not proven (anyone may connect as an
// operator, or call the state route with no role), so this saves the screens work and
// keeps them parsing; it does not keep any data secret.
import { obsSliceWithoutObs, type SliceNameSentWhole, type Slices } from '@bajaovrlay/shared';

/** The slices a screen draws: the only ones it is sent with something in them. */
export const sliceNamesScreensReceive: readonly SliceNameSentWhole[] = [
  'outputs',
  'layers',
  'graphics',
  'instances',
  'previewClearedLayerIds',
];

/**
 * A screen's copy of every slice, for its hello, its state read and every change: the
 * outputs and graphics whole, the layers of its output, and the instances and "vai limpar"
 * marks of those layers. The schema requires every slice, so each slice a screen does not
 * draw is there but empty: empty on purpose for a screen, not "no data". Written out slice
 * by slice on purpose: a slice added to the schema later fails typecheck here until
 * someone decides what a screen gets of it. Keep the five sent ones in step with
 * sliceNamesScreensReceive above.
 */
export function buildSlicesForAScreen(slices: Slices, outputId: string): Slices {
  const layersOfTheOutput = slices.layers.filter((layer) => layer.outputId === outputId);
  const layerIdsOfTheOutput = new Set(layersOfTheOutput.map((layer) => layer.id));
  return {
    outputs: slices.outputs,
    layers: layersOfTheOutput,
    graphics: slices.graphics,
    instances: slices.instances.filter((instance) => layerIdsOfTheOutput.has(instance.layerId)),
    previewClearedLayerIds: slices.previewClearedLayerIds.filter((layerId) =>
      layerIdsOfTheOutput.has(layerId),
    ),
    // The bindings behind what is on air: graphics get resolved data only (rule 3).
    instanceBindings: [],
    rundowns: [],
    items: [],
    quickFirePanels: [],
    macros: [],
    macroRuns: [],
    macroStops: [],
    // An object, not a list: a screen gets "no OBS", as a server with no address has.
    obs: obsSliceWithoutObs,
    dataSources: [],
    dataSnapshots: [],
    overrides: [],
    recordings: [],
    events: [],
    eventRules: [],
    // The entity library and its images: a graphic gets a team's name or logo URL
    // already resolved, and loads the image itself through <img>.
    teams: [],
    people: [],
    sponsors: [],
    scheduleSlots: [],
    media: [],
    eventLog: [],
  };
}

/**
 * The changed slice names a screen is told about, in the same order, out of those sent
 * whole: only the ones it draws. May be empty, and then the screen is sent nothing for
 * that change (a poll, which changes the source and its snapshot, or a refused command,
 * which changes the event log alone). A slice it does not draw is left out of the
 * message rather than sent empty: its hello already holds that slice empty, and nothing
 * changes it afterwards, so an older page keeps parsing every message.
 */
export function keepSliceNamesScreensReceive(
  changedSliceNames: SliceNameSentWhole[],
): SliceNameSentWhole[] {
  return changedSliceNames.filter((changedSliceName) => {
    const isDrawnByAScreen = sliceNamesScreensReceive.some(
      (drawnSliceName) => drawnSliceName === changedSliceName,
    );
    return isDrawnByAScreen;
  });
}

/** The JSON text of each slice a screen draws, by slice name. */
export type TextsOfTheSlicesAScreenDraws = Map<SliceNameSentWhole, string>;

/**
 * The JSON text of each slice a screen draws, out of a screen's copy of the slices
 * (buildSlicesForAScreen): what the hub remembers having sent a screen, and compares with.
 */
export function writeTextsOfTheSlicesAScreenDraws(
  slicesForAScreen: Slices,
): TextsOfTheSlicesAScreenDraws {
  const texts: TextsOfTheSlicesAScreenDraws = new Map();
  for (const sliceName of sliceNamesScreensReceive) {
    texts.set(sliceName, JSON.stringify(slicesForAScreen[sliceName]));
  }
  return texts;
}

/**
 * Of the changed slice names a screen draws, the ones whose text now differs from the
 * text last sent to that screen (gate 2 of PR #32). A take on the PiP changes the
 * instances slice, but program's copy of it is the same list as before, so a program
 * screen is sent nothing and OBS's main source parses nothing. Compared with what was
 * last sent, not with the slices from before the change: a listener may apply a command
 * while the store is still telling the hub of another, and then the hub hears of the
 * second change first (webSocketHubNestedChanges.test.ts).
 */
export function keepSliceNamesWhoseTextDiffersFromTheLastSent(
  sliceNamesScreensDraw: SliceNameSentWhole[],
  textsLastSent: TextsOfTheSlicesAScreenDraws,
  textsNow: TextsOfTheSlicesAScreenDraws,
): SliceNameSentWhole[] {
  return sliceNamesScreensDraw.filter(
    (sliceName) => textsLastSent.get(sliceName) !== textsNow.get(sliceName),
  );
}
