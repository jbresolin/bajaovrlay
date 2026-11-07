/**
 * An HTTP call with a body puts a filled lower third on air through a trigger
 * (apps/control, BAJAOVRLAY-48, the brief's E2E)
 *
 * What this module is for:
 *   A trigger runs a macro when something outside the operator's hands happens. Here the
 *   something is a call to an HTTP trigger's address, as a D200 sends it through Companion,
 *   with a body `{ "nome": "Ana Souza" }`. The trigger runs its macro at once ("auto"), and
 *   the macro's take step fills the lower third's name from "Dado do gatilho › nome".
 *
 * What this test proves, against the real server, the real built renderer and a real
 * SQLite file:
 *   - the call answers 200;
 *   - the lower third goes on air with "Ana Souza" as its name and the item's own role,
 *     both in the server's state and drawn on the program output OBS loads (`/render/`).
 *
 * What it deliberately does not cover:
 *   - The trigger editor and the take step's "Dado do gatilho" on the page; their
 *     component tests cover them. The setup is sent over the WebSocket as the page sends it.
 *   - Refused calls, scene, event and schedule triggers, the rules against loops; the
 *     server's modules/triggers tests cover them on fake time.
 *
 * What it needs: the lower third and the renderer built (`pnpm build`).
 */
import { expect, type Page, test } from '@playwright/test';

import { emptyTheServerState, realServerPort } from './emptyTheServerState';
import { sendCommandOrFail } from './eventInboxOnTheRealServer';
import { callTheHttpTrigger } from './triggerCallsOnTheRealServer';

// Long enough for a slow CI machine to load the graphic; the test waits on the thing itself.
const waitForTheAirInMilliseconds = 10_000;

/** What the test reads of GET /api/v1/state. */
type StateTheTriggerTestReads = {
  macros: Array<{ id: string; label: string }>;
  triggers: Array<{ id: string; name: string }>;
  instances: Array<{ layerId: string; target: string; resolvedData: Record<string, unknown> }>;
};

/** Reads the run's server state. */
async function readStateOfTheRealServer(): Promise<StateTheTriggerTestReads> {
  const response = await fetch(`http://127.0.0.1:${String(realServerPort)}/api/v1/state`);
  return (await response.json()) as StateTheTriggerTestReads;
}

/**
 * Prepares the show as an operator would: a "Tarja" item for the interviewee, a macro
 * "Entrevista no box" whose take fills the name from the trigger's `nome`, and an HTTP
 * trigger "Entrevista pelo D200" that runs it by itself. Returns the trigger's id.
 */
async function prepareTheInterviewButton(): Promise<string> {
  const itemAnswer = await sendCommandOrFail(realServerPort, {
    type: 'createItem',
    home: { kind: 'quickFire', panelId: 'atalhos' },
    graphicId: 'lower-third',
    layerId: 'lower-third',
    label: 'Entrevistado no box',
    fields: {
      name: { kind: 'literal', value: 'Convidado do box' },
      role: { kind: 'literal', value: 'Entrevista' },
    },
  });
  await sendCommandOrFail(realServerPort, {
    type: 'createMacro',
    label: 'Entrevista no box',
    color: 'info',
    steps: [
      {
        kind: 'takeItem',
        itemId: itemAnswer.createdItemId,
        triggerFields: { name: { kind: 'triggerData', key: 'nome' } },
      },
    ],
  });
  const stateWithTheMacro = await readStateOfTheRealServer();
  const macroId = stateWithTheMacro.macros.find((macro) => macro.label === 'Entrevista no box')?.id;
  await sendCommandOrFail(realServerPort, {
    type: 'createTrigger',
    name: 'Entrevista pelo D200',
    when: { kind: 'http' },
    macroId,
    mode: 'auto',
  });
  const stateWithTheTrigger = await readStateOfTheRealServer();
  const trigger = stateWithTheTrigger.triggers.find(
    (candidate) => candidate.name === 'Entrevista pelo D200',
  );
  return trigger?.id ?? 'gatilho-nao-criado';
}

/**
 * Opens the program output as OBS does, at `/render/`, and returns once it has drawn its
 * lower-third layer (it does so only after the server sent it the state).
 */
async function openProgramOutputAsObsDoes(page: Page): Promise<void> {
  await page.goto('/render/');
  await expect(
    page.locator('[data-layer-id="lower-third"]'),
    'the OBS stand-in must be connected and have drawn its lower-third layer',
  ).toBeAttached();
}

test.beforeEach(async () => {
  await emptyTheServerState();
});

test('an HTTP call with a body puts the lower third on air with the name it carried', async ({
  page,
}) => {
  // Arrange: the interview button's trigger, and OBS showing the program output.
  const triggerId = await prepareTheInterviewButton();
  await openProgramOutputAsObsDoes(page);

  // Act: the D200 calls the trigger with Ana Souza's name.
  const status = await callTheHttpTrigger(triggerId, { nome: 'Ana Souza' });

  // Assert: 200, her name and the item's role on air, drawn on the program output.
  expect(status, 'a trigger that fired answers 200').toBe(200);
  await expect
    .poll(
      async () => {
        const state = await readStateOfTheRealServer();
        const onAir = state.instances.find(
          (instance) => instance.layerId === 'lower-third' && instance.target === 'program',
        );
        return onAir?.resolvedData;
      },
      {
        message: 'the lower third on air must carry the name from the call',
        timeout: waitForTheAirInMilliseconds,
      },
    )
    .toEqual({ name: 'Ana Souza', role: 'Entrevista' });
  await expect(
    page
      .locator('[data-layer-id="lower-third"] > baja-graphic-lower-third')
      .getByTestId('lower-third-name-pill'),
    'the program output must draw the name the call carried',
  ).toContainText('Ana Souza', { timeout: waitForTheAirInMilliseconds });
});
