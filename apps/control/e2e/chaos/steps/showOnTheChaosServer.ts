// Test support (chaos suite): setting up a show on a chaos server the fast way, with the
// commands the console sends (over a WebSocket of the test's own, eventInboxOnTheRealServer.ts),
// and reading what the server holds (GET /api/v1/state). A scenario sets up with these and
// watches the pages for what an operator and a viewer see. Functions only.
import { buildBajaAppRaceSourceConfig } from '@bajaovrlay/shared';
import { expect } from '@playwright/test';

import { sendCommandOrFail } from '../../eventInboxOnTheRealServer';

export { sendCommandOrFail, sendCommandToTheServerOnPort } from '../../eventInboxOnTheRealServer';

/** One instance as GET /api/v1/state lists it, the parts the scenarios read. */
export type InstanceAsTheScenariosReadIt = {
  id: string;
  layerId: string;
  target: string;
  graphicId: string;
  itemId?: string;
  currentStep?: number;
  resolvedData: Record<string, unknown>;
};

/** One data source as GET /api/v1/state lists it, the parts the scenarios read. */
export type DataSourceAsTheScenariosReadIt = {
  id: string;
  label: string;
  isEnabled: boolean;
  status: { isStale: boolean; lastError: string | null; consecutiveFailures: number };
};

/** The parts of GET /api/v1/state the scenarios read. */
export type StateTheScenariosRead = {
  instances: InstanceAsTheScenariosReadIt[];
  dataSources: DataSourceAsTheScenariosReadIt[];
  items: Array<{ id: string; label: string }>;
  macros: Array<{ id: string; label: string }>;
  macroRuns: Array<{ macroId: string }>;
  macroStops: Array<{ macroId: string; stepIndex: number; reason: string }>;
  /** heldByThePause: why "Pausar gatilhos" made an auto event wait (BAJAOVRLAY-73). */
  events: Array<{ eventId: string; kind: string; status: string; heldByThePause?: string }>;
};

/** The rundown every new database seeds, where the scenarios' items go. */
export const seededRundownId = 'sessao-principal';

/** What the state of the server on this port is now, as GET /api/v1/state answers it. */
export async function readStateOfTheChaosServer(port: number): Promise<StateTheScenariosRead> {
  const response = await fetch(`http://127.0.0.1:${String(port)}/api/v1/state`);
  if (!response.ok) {
    throw new Error(`GET /api/v1/state answered ${String(response.status)} on ${String(port)}`);
  }
  return (await response.json()) as StateTheScenariosRead;
}

/** The instance on program on this layer now, or undefined when the layer is empty. */
export async function readInstanceOnProgram(
  port: number,
  layerId: string,
): Promise<InstanceAsTheScenariosReadIt | undefined> {
  const state = await readStateOfTheChaosServer(port);
  return state.instances.find(
    (instance) => instance.layerId === layerId && instance.target === 'program',
  );
}

/** The data source with this label now; fails, naming it, when there is none. */
export async function readDataSourceByLabel(
  port: number,
  label: string,
): Promise<DataSourceAsTheScenariosReadIt> {
  const state = await readStateOfTheChaosServer(port);
  const source = state.dataSources.find((dataSource) => dataSource.label === label);
  if (source === undefined) {
    throw new Error(`the chaos server has no data source named "${label}"`);
  }
  return source;
}

/** The label of the Baja app race source the scenarios make. */
export const bajaAppRaceSourceLabel = 'Baja app — Enduro 26BR';

/**
 * Makes the Baja app's race source of 26BR's Enduro ("Adicionar fonte do app Baja", the
 * preset) pointed at this API address, read every 0,5 s (so its timeout is 0,5 s), and
 * turns it on. Answers its id.
 */
export async function makeBajaAppRaceSource(port: number, apiAddress: string): Promise<string> {
  const config = buildBajaAppRaceSourceConfig({
    apiAddress,
    eventId: '26BR',
    provaId: 'END',
    acceptsSimulatedRace: false,
  });
  await sendCommandOrFail(port, {
    type: 'createDataSource',
    label: bajaAppRaceSourceLabel,
    kind: 'httpJson',
    config,
    pollIntervalMs: 500,
  });
  const source = await readDataSourceByLabel(port, bajaAppRaceSourceLabel);
  await sendCommandOrFail(port, {
    type: 'setDataSourceEnabled',
    sourceId: source.id,
    isEnabled: true,
  });
  return source.id;
}

/**
 * Makes a "Torre de posições" item in the rundown whose cars read this source live (the
 * manifest's suggested binding), and takes it. Answers the item's id once the tower is on
 * program.
 */
export async function takeTowerReadingTheSource(port: number, sourceId: string): Promise<string> {
  const answer = await sendCommandOrFail(port, {
    type: 'createItem',
    home: { kind: 'rundown', rundownId: seededRundownId },
    graphicId: 'positions-tower',
    layerId: 'tower',
    label: 'Torre — Enduro',
    fields: {
      entries: { kind: 'binding', sourceId, shapeKey: 'positions', path: 'entries', isLive: true },
    },
  });
  const itemId = answer.createdItemId ?? '';
  await sendCommandOrFail(port, { type: 'takeItem', itemId });
  return itemId;
}

/** Waits until the server says this source is late and failing for this reason. */
export async function waitUntilTheSourceIsLateBecause(
  port: number,
  label: string,
  reason: string | RegExp,
): Promise<void> {
  await expect
    .poll(
      async () => {
        const source = await readDataSourceByLabel(port, label);
        return source.status.isStale ? (source.status.lastError ?? 'late, with no reason') : 'ok';
      },
      { message: `"${label}" must be late, failing for the reason expected` },
    )
    .toMatch(reason);
}

/** Waits until the server says this source is healthy again. */
export async function waitUntilTheSourceIsHealthy(port: number, label: string): Promise<void> {
  await expect
    .poll(async () => (await readDataSourceByLabel(port, label)).status.isStale, {
      message: `"${label}" must be healthy again`,
    })
    .toBe(false);
}

/**
 * Makes a "Tarja" button on the seeded "Atalhos" panel, the interviewee typed in: the
 * first button, so the console's key 1 takes it. Answers the item's id.
 */
export async function makeLowerThirdButton(
  port: number,
  label: string,
  personName: string,
): Promise<string> {
  const answer = await sendCommandOrFail(port, {
    type: 'createItem',
    home: { kind: 'quickFire', panelId: 'atalhos' },
    graphicId: 'lower-third',
    layerId: 'lower-third',
    label,
    fields: {
      name: { kind: 'literal', value: personName },
      role: { kind: 'literal', value: 'Capitã da equipe 42, Baja UFPR' },
    },
  });
  return answer.createdItemId ?? '';
}

/**
 * Makes a race clock item of the enduro under green flag, counting up from 1:05:00 from
 * this moment, and takes it: a clock running on air. The server's clock is this machine's
 * own (NTP off), so "now" here is "now" there. Answers the item's id.
 */
export async function takeRunningEnduroClock(port: number): Promise<string> {
  const clockData = {
    sessionName: 'Enduro de Resistência',
    state: 'green',
    clockMode: 'elapsed',
    referenceTimeMs: 3_900_000,
    referenceWallClockMs: Date.now(),
    running: true,
    lapsCompletedByLeader: 12,
  };
  const fields: Record<string, { kind: 'literal'; value: unknown }> = {};
  for (const [fieldKey, value] of Object.entries(clockData)) {
    fields[fieldKey] = { kind: 'literal', value };
  }
  const answer = await sendCommandOrFail(port, {
    type: 'createItem',
    home: { kind: 'rundown', rundownId: seededRundownId },
    graphicId: 'race-clock',
    layerId: 'clock',
    label: 'Relógio do enduro',
    fields,
  });
  const itemId = answer.createdItemId ?? '';
  await sendCommandOrFail(port, { type: 'takeItem', itemId });
  return itemId;
}

/** Makes a macro with these steps and answers its id, read back by its label. */
export async function makeMacro(
  port: number,
  label: string,
  steps: Array<Record<string, unknown>>,
): Promise<string> {
  await sendCommandOrFail(port, { type: 'createMacro', label, steps });
  const state = await readStateOfTheChaosServer(port);
  const macro = state.macros.find((eachMacro) => eachMacro.label === label);
  if (macro === undefined) {
    throw new Error(`the chaos server has no macro named "${label}"`);
  }
  return macro.id;
}

/**
 * Makes a full-screen countdown to the enduro's start, `startsAtMs` on the server's clock,
 * and takes it on "Tela cheia". Answers the item's id.
 */
export async function takeCountdownToTheStart(port: number, startsAtMs: number): Promise<string> {
  const answer = await sendCommandOrFail(port, {
    type: 'createItem',
    home: { kind: 'rundown', rundownId: seededRundownId },
    graphicId: 'countdown',
    layerId: 'fullscreen',
    label: 'Contagem para a largada',
    fields: {
      layout: { kind: 'literal', value: 'fullscreen' },
      sessionName: { kind: 'literal', value: 'Enduro de Resistência' },
      startsAtMs: { kind: 'literal', value: startsAtMs },
    },
  });
  const itemId = answer.createdItemId ?? '';
  await sendCommandOrFail(port, { type: 'takeItem', itemId });
  return itemId;
}

/** What GET /health says of the server clock: the last NTP answer, if any, and how far off. */
export type ServerClockAsHealthSaysIt = {
  lastNtpAnswer: { atMs: number; differenceMs: number } | null;
  offFromRealTimeMs: number;
};

/** Reads the server clock's part of GET /health. */
export async function readServerClockHealth(port: number): Promise<ServerClockAsHealthSaysIt> {
  const response = await fetch(`http://127.0.0.1:${String(port)}/health`);
  const health = (await response.json()) as { serverClock: ServerClockAsHealthSaysIt };
  return health.serverClock;
}
