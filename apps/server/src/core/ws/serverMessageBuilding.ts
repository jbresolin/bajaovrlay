import {
  type ChangedSlices,
  type CommandError,
  type CommandResultMessage,
  type DataSnapshotMessage,
  type ServerMessage,
  ServerMessageSchema,
  type SliceMessage,
  type SliceName,
  type SliceNameSentWhole,
  SliceNameSentWholeSchema,
  type Slices,
  type SlicesMessage,
  type TimeMessage,
} from '@bajaovrlay/shared';

import type { DataSnapshotChange } from '../store/dataSnapshotChanges.js';

/**
 * The `hello` a client gets right after connecting: every slice, `serverNowMs` (what the
 * server's wall clock shows now, in milliseconds) and, when the server has one, the
 * `buildId` its built pages embed. With no build id the field is left out altogether.
 */
export function buildHelloMessage(
  slices: Slices,
  serverNowMs: number,
  buildId: string | undefined,
): ServerMessage {
  if (buildId === undefined) {
    return { type: 'hello', slices, serverNowMs };
  }
  return { type: 'hello', slices, serverNowMs, buildId };
}

/**
 * The `slice` message for one slice, read from the current slices, with `serverNowMs`,
 * what the server's wall clock shows now, in milliseconds. A renderer compares that with
 * its own clock so the race clock on air counts on the server's.
 */
export function buildSliceMessage(
  sliceName: SliceNameSentWhole,
  slices: Slices,
  serverNowMs: number,
): SliceMessage {
  switch (sliceName) {
    case 'outputs':
      return { type: 'slice', name: 'outputs', slice: slices.outputs, serverNowMs };
    case 'layers':
      return { type: 'slice', name: 'layers', slice: slices.layers, serverNowMs };
    case 'graphics':
      return { type: 'slice', name: 'graphics', slice: slices.graphics, serverNowMs };
    case 'instances':
      return { type: 'slice', name: 'instances', slice: slices.instances, serverNowMs };
    case 'previewClearedLayerIds':
      return {
        type: 'slice',
        name: 'previewClearedLayerIds',
        slice: slices.previewClearedLayerIds,
        serverNowMs,
      };
    case 'instanceBindings':
      return {
        type: 'slice',
        name: 'instanceBindings',
        slice: slices.instanceBindings,
        serverNowMs,
      };
    case 'rundowns':
      return { type: 'slice', name: 'rundowns', slice: slices.rundowns, serverNowMs };
    case 'items':
      return { type: 'slice', name: 'items', slice: slices.items, serverNowMs };
    case 'quickFirePanels':
      return { type: 'slice', name: 'quickFirePanels', slice: slices.quickFirePanels, serverNowMs };
    case 'macros':
      return { type: 'slice', name: 'macros', slice: slices.macros, serverNowMs };
    case 'macroRuns':
      return { type: 'slice', name: 'macroRuns', slice: slices.macroRuns, serverNowMs };
    case 'dataSources':
      return { type: 'slice', name: 'dataSources', slice: slices.dataSources, serverNowMs };
    case 'overrides':
      return { type: 'slice', name: 'overrides', slice: slices.overrides, serverNowMs };
    case 'recordings':
      return { type: 'slice', name: 'recordings', slice: slices.recordings, serverNowMs };
    case 'events':
      return { type: 'slice', name: 'events', slice: slices.events, serverNowMs };
    case 'eventRules':
      return { type: 'slice', name: 'eventRules', slice: slices.eventRules, serverNowMs };
    case 'teams':
      return { type: 'slice', name: 'teams', slice: slices.teams, serverNowMs };
    case 'people':
      return { type: 'slice', name: 'people', slice: slices.people, serverNowMs };
    case 'sponsors':
      return { type: 'slice', name: 'sponsors', slice: slices.sponsors, serverNowMs };
    case 'scheduleSlots':
      return { type: 'slice', name: 'scheduleSlots', slice: slices.scheduleSlots, serverNowMs };
    case 'media':
      return { type: 'slice', name: 'media', slice: slices.media, serverNowMs };
    case 'eventLog':
      return { type: 'slice', name: 'eventLog', slice: slices.eventLog, serverNowMs };
  }
}

/**
 * The `slices` message for several slices changed by one state change, read from the
 * current slices, with `serverNowMs` as in buildSliceMessage. The slices keep the order
 * of the names given, which is the order the store reports changes in.
 */
export function buildSlicesMessage(
  changedSliceNames: SliceNameSentWhole[],
  slices: Slices,
  serverNowMs: number,
): SlicesMessage {
  const changedSlices: ChangedSlices = {};
  for (const sliceName of changedSliceNames) {
    copyOneSliceByName(sliceName, slices, changedSlices);
  }
  return { type: 'slices', slices: changedSlices, serverNowMs };
}

/**
 * Copies the slice of that name into the group. One case per name, written out, so the
 * compiler checks each name gets the kind of list that belongs to it.
 */
function copyOneSliceByName(
  sliceName: SliceNameSentWhole,
  slices: Slices,
  group: ChangedSlices,
): void {
  switch (sliceName) {
    case 'outputs':
      group.outputs = slices.outputs;
      break;
    case 'layers':
      group.layers = slices.layers;
      break;
    case 'graphics':
      group.graphics = slices.graphics;
      break;
    case 'instances':
      group.instances = slices.instances;
      break;
    case 'previewClearedLayerIds':
      group.previewClearedLayerIds = slices.previewClearedLayerIds;
      break;
    case 'instanceBindings':
      group.instanceBindings = slices.instanceBindings;
      break;
    case 'rundowns':
      group.rundowns = slices.rundowns;
      break;
    case 'items':
      group.items = slices.items;
      break;
    case 'quickFirePanels':
      group.quickFirePanels = slices.quickFirePanels;
      break;
    case 'macros':
      group.macros = slices.macros;
      break;
    case 'macroRuns':
      group.macroRuns = slices.macroRuns;
      break;
    case 'dataSources':
      group.dataSources = slices.dataSources;
      break;
    case 'overrides':
      group.overrides = slices.overrides;
      break;
    case 'recordings':
      group.recordings = slices.recordings;
      break;
    case 'events':
      group.events = slices.events;
      break;
    case 'eventRules':
      group.eventRules = slices.eventRules;
      break;
    case 'teams':
      group.teams = slices.teams;
      break;
    case 'people':
      group.people = slices.people;
      break;
    case 'sponsors':
      group.sponsors = slices.sponsors;
      break;
    case 'scheduleSlots':
      group.scheduleSlots = slices.scheduleSlots;
      break;
    case 'media':
      group.media = slices.media;
      break;
    case 'eventLog':
      group.eventLog = slices.eventLog;
      break;
    default: {
      // A slice added to SliceNameSentWhole without its case here stops the build: its
      // changes would otherwise never reach open pages (as the two new slices of
      // BAJAOVRLAY-20 did not, until the walk found it).
      const sliceNameWithoutItsCase: never = sliceName;
      throw new Error(`no case for slice ${String(sliceNameWithoutItsCase)}`);
    }
  }
}

/**
 * The changed slice names a `slice` or `slices` message may carry, in the same order:
 * every name but `dataSnapshots`, whose change is sent source by source instead
 * (buildDataSnapshotMessage). May be empty, and then no `slice` or `slices` is sent.
 */
export function keepSliceNamesSentWhole(changedSliceNames: SliceName[]): SliceNameSentWhole[] {
  const sliceNamesSentWhole: SliceNameSentWhole[] = [];
  for (const changedSliceName of changedSliceNames) {
    const nameCheck = SliceNameSentWholeSchema.safeParse(changedSliceName);
    if (nameCheck.success) {
      sliceNamesSentWhole.push(nameCheck.data);
    }
  }
  return sliceNamesSentWhole;
}

/**
 * The `dataSnapshot` message for one source whose snapshot changed: the new snapshot, or
 * null when it is gone, with `serverNowMs` as in buildSliceMessage.
 */
export function buildDataSnapshotMessage(
  change: DataSnapshotChange,
  serverNowMs: number,
): DataSnapshotMessage {
  return {
    type: 'dataSnapshot',
    sourceId: change.sourceId,
    snapshot: change.snapshot,
    serverNowMs,
  };
}

/**
 * The `time` message every client gets every ten seconds: `serverNowMs`, what the
 * server's wall clock shows now, in milliseconds, and nothing else.
 */
export function buildTimeMessage(serverNowMs: number): TimeMessage {
  return { type: 'time', serverNowMs };
}

/**
 * The ok `commandResult`, echoing the client's requestId (or null), and naming the item an
 * accepted createItem made when there is one.
 */
export function buildOkCommandResult(
  requestId: string | null,
  createdItemId?: string,
): CommandResultMessage {
  if (createdItemId === undefined) {
    return { type: 'commandResult', requestId, ok: true };
  }
  return { type: 'commandResult', requestId, ok: true, createdItemId };
}

/** The error `commandResult`, echoing the client's requestId (or null). */
export function buildErrorCommandResult(
  requestId: string | null,
  error: CommandError,
): CommandResultMessage {
  return { type: 'commandResult', requestId, ok: false, error };
}

/**
 * Checks an outgoing message against the shared schema and returns its JSON text.
 * Validating on the way out too means a server bug throws here, in the server's log,
 * instead of being sent to every client.
 */
export function serializeServerMessage(message: ServerMessage): string {
  return JSON.stringify(ServerMessageSchema.parse(message));
}
