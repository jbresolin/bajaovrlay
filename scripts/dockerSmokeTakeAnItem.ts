// The WebSocket step of scripts/dockerSmoke.sh: on the container at the port given, takes
// a race clock item over the WebSocket with the control page's browser-test helper, or
// checks that the clock it took is still on air (after the container restarted). Exits 1,
// saying why, when the server refuses or the clock is not where it should be.
//
//   tsx scripts/dockerSmokeTakeAnItem.ts take  <port>
//   tsx scripts/dockerSmokeTakeAnItem.ts check <port>
import {
  readInboxStateOfTheServerOnPort,
  sendCommandOrFail,
} from '../apps/control/e2e/eventInboxOnTheRealServer.js';

// The label the take gives the item, which the check then looks for after the restart.
const smokeItemLabel = 'Relógio do enduro — teste do Docker';

/** The parts of GET /api/v1/state the check reads. */
type StateTheSmokeReads = {
  items: Array<{ id: string; label: string }>;
  instances: Array<{ layerId: string; target: string; itemId?: string }>;
};

/** Makes the held enduro clock an item of "Sessão principal" and takes it. */
async function takeTheSmokeClock(port: number): Promise<void> {
  const created = await sendCommandOrFail(port, {
    type: 'createItem',
    home: { kind: 'rundown', rundownId: 'sessao-principal' },
    layerId: 'clock',
    graphicId: 'race-clock',
    label: smokeItemLabel,
    fields: {
      sessionName: { kind: 'literal', value: 'Enduro de Resistência' },
      state: { kind: 'literal', value: 'green' },
      clockMode: { kind: 'literal', value: 'elapsed' },
      referenceTimeMs: { kind: 'literal', value: 3_900_000 },
      referenceWallClockMs: { kind: 'literal', value: Date.parse('2026-05-16T14:30:00.000Z') },
      running: { kind: 'literal', value: false },
      lapsCompletedByLeader: { kind: 'literal', value: 12 },
    },
  });
  await sendCommandOrFail(port, { type: 'takeItem', itemId: created.createdItemId });
}

/** Answers why the smoke clock is not on air on the clock layer, or undefined when it is. */
async function findWhyTheSmokeClockIsNotOnAir(port: number): Promise<string | undefined> {
  // The helper reads GET /api/v1/state whole; these are the parts read here.
  const state = (await readInboxStateOfTheServerOnPort(port)) as unknown as StateTheSmokeReads;
  const smokeItem = state.items.find((item) => item.label === smokeItemLabel);
  if (smokeItem === undefined) {
    return `no item "${smokeItemLabel}" in the state`;
  }
  const clockOnAir = state.instances.find(
    (instance) => instance.layerId === 'clock' && instance.target === 'program',
  );
  if (clockOnAir?.itemId !== smokeItem.id) {
    return `the clock layer does not show item ${smokeItem.id}`;
  }
  return undefined;
}

const [step, portText] = process.argv.slice(2);
const port = Number(portText);
if (step === 'take') {
  await takeTheSmokeClock(port);
}
const whyNotOnAir = await findWhyTheSmokeClockIsNotOnAir(port);
if (whyNotOnAir !== undefined) {
  process.stderr.write(`the smoke clock is not on air: ${whyNotOnAir}\n`);
  process.exit(1);
}
