/**
 * Take race clock panel: the form following what is on air (apps/control)
 *
 * What this module is for:
 *   "Atualizar" sends the fields the operator changed and keeps the rest as it is on
 *   air. For that to stay true the form must know two things at every moment: what is
 *   on air, and which fields hold a change the operator has not sent yet. These tests
 *   follow the form through the moments where that could go wrong.
 *
 * What these tests prove:
 *   - After a take or an "Atualizar" the server accepted, the form shows what is now on
 *     air and counts as untouched again: the next "Atualizar" does not send the earlier
 *     edit a second time.
 *   - After a refusal the operator's edit is still in the form and still goes out on
 *     the next press.
 *   - When someone else changes the clock while the operator is half-way through an
 *     edit, the edit is kept, the untouched fields follow the air, and the edit then
 *     goes out without undoing the other operator's change.
 *   - "Colocar no ar" always sends the form as it stands, typed time included.
 *   - On-air data that cannot be read leaves the form alone, and "Atualizar" then sends
 *     the whole form.
 *
 * What these tests deliberately do not cover:
 *   - "Atualizar" right after a reload (the three scenarios of the ruling) and the form
 *     as the page loads: TakeRaceClockPanel.test.tsx.
 *   - Every combination of changed fields, and stopped clocks and countdowns:
 *     raceClockUpdateCommand.test.ts and raceClockDataOnAir.test.ts.
 *   - The clock leaving the air ("Limpar"): the form is then simply left as it is.
 *   - The real server's order of messages (the changed slice, then "ok"); the fake
 *     server copies it and apps/server's own tests prove it.
 */
import type { Instance } from '@bajaovrlay/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  type ControlPageOnFakeServer,
  renderOnControlPageConnectedToFakeServer,
} from '@/state/controlPageOnFakeServer.testSupport';
import { buildSlicesWithNothingOnAir } from '@/state/slicesLikeTheServerSends.testSupport';

import {
  buildRaceClockInstanceHoldingThisData,
  chooseOptionInDropdown,
  letTheServerPutTheLastTakeOnAir,
  typeIntoField,
} from './operatingTheRaceClockForm.testSupport';
import { TakeRaceClockPanel } from './TakeRaceClockPanel';

// The Saturday of the endurance race, in Brasília time: the clock went on air at 9:45,
// the operator first presses a button at 10:00 and comes back to the panel at 10:05.
const quarterToTen = '2026-10-10T12:45:00.000Z';
const tenOClock = '2026-10-10T13:00:00.000Z';
const fivePastTen = '2026-10-10T13:05:00.000Z';

type FakeServer = ControlPageOnFakeServer['fakeServer'];

/** The first heat as the server holds it: green flag, running from 12:34 since 9:45. */
function buildFirstHeatDataOnAir() {
  return {
    sessionName: 'Enduro de Resistência — Bateria 1',
    state: 'green',
    clockMode: 'elapsed',
    referenceTimeMs: 754_000,
    referenceWallClockMs: Date.parse(quarterToTen),
    running: true,
  };
}

/**
 * Draws the panel at 10:00 on a connected page with these instances on air. The test
 * owns the page's clock: `moveThePageClockTo` changes what the panel is told "now" is.
 */
function renderPanelAtTenOClock(instancesOnAir: Instance[]) {
  const clockOfThisPage = { nowInMilliseconds: Date.parse(tenOClock) };
  const controlPage = renderOnControlPageConnectedToFakeServer(
    <TakeRaceClockPanel readCurrentTimeInMilliseconds={() => clockOfThisPage.nowInMilliseconds} />,
    { ...buildSlicesWithNothingOnAir(), instances: instancesOnAir },
  );
  return {
    fakeServer: controlPage.fakeServer,
    moveThePageClockTo: (moment: string) => {
      clockOfThisPage.nowInMilliseconds = Date.parse(moment);
    },
  };
}

/** The same panel with the first heat on air since 9:45. */
function renderPanelAtTenOClockWithTheFirstHeatOnAir() {
  return renderPanelAtTenOClock([
    buildRaceClockInstanceHoldingThisData(buildFirstHeatDataOnAir(), quarterToTen),
  ]);
}

/** Presses a button and waits until the fake server holds that many commands. */
async function pressButtonAndWaitForCommand(
  buttonName: string,
  commandsExpectedByThen: number,
  fakeServer: FakeServer,
) {
  fireEvent.click(screen.getByRole('button', { name: buttonName }));
  await waitFor(() => {
    expect(
      fakeServer.listCommandsReceived(),
      `pressing "${buttonName}" must send a command`,
    ).toHaveLength(commandsExpectedByThen);
  });
}

/**
 * What this page hears when a second operator, at 10:00, shows the red flag and stops
 * the first heat's clock at the 27:34 (1 654 000 ms) it shows.
 */
function letASecondOperatorStopTheClockUnderTheRedFlag(fakeServer: FakeServer) {
  const dataAfterTheRedFlag = {
    ...buildFirstHeatDataOnAir(),
    state: 'red',
    referenceTimeMs: 1_654_000,
    referenceWallClockMs: Date.parse(tenOClock),
    running: false,
  };
  fakeServer.sendMessage({
    type: 'slice',
    name: 'instances',
    slice: [buildRaceClockInstanceHoldingThisData(dataAfterTheRedFlag, tenOClock)],
  });
}

describe('the race clock form following what is on air', () => {
  it('starts untouched again after an accepted "Atualizar": the next press does not resend the typed time', async () => {
    // Arrange: the first heat on air. At 10:00 the operator corrects the clock to 20:00
    // with "Atualizar", and the server puts that on air and accepts.
    const { fakeServer, moveThePageClockTo } = renderPanelAtTenOClockWithTheFirstHeatOnAir();
    typeIntoField('Tempo de referência (mm:ss)', '20:00');
    await pressButtonAndWaitForCommand('Atualizar', 1, fakeServer);
    letTheServerPutTheLastTakeOnAir(fakeServer, tenOClock);
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Atualizar' }),
        'the button must come back once the server has answered',
      ).toBeEnabled();
    });

    // Act: five minutes later the operator presses "Atualizar" again without touching
    // anything.
    moveThePageClockTo(fivePastTen);
    await pressButtonAndWaitForCommand('Atualizar', 2, fakeServer);

    // Assert: the second command carries the time the clock shows now, 25:00
    // (1 500 000 ms), counted from 10:05. Had the form still counted the time field as
    // changed, the clock would have jumped back to 20:00.
    expect(
      fakeServer.listCommandsReceived()[1],
      'a field already sent must not be sent again as a change',
    ).toEqual({
      type: 'takeGraphic',
      graphicId: 'race-clock',
      layerId: 'clock',
      data: {
        sessionName: 'Enduro de Resistência — Bateria 1',
        state: 'green',
        clockMode: 'elapsed',
        referenceTimeMs: 1_500_000,
        referenceWallClockMs: Date.parse(fivePastTen),
        running: true,
      },
    });
    fakeServer.acceptLastCommand();
  });

  it('starts untouched after an accepted "Colocar no ar": a later flag change keeps the clock running', async () => {
    // Arrange: nothing on air. At 10:00 the operator fills the form for the first heat
    // and presses "Colocar no ar"; the server puts it on air and accepts.
    const { fakeServer, moveThePageClockTo } = renderPanelAtTenOClock([]);
    typeIntoField('Nome da sessão', 'Enduro de Resistência — Bateria 1');
    chooseOptionInDropdown('Bandeira', 'Verde');
    fireEvent.click(screen.getByRole('switch', { name: 'Relógio correndo' }));
    typeIntoField('Tempo de referência (mm:ss)', '12:34');
    await pressButtonAndWaitForCommand('Colocar no ar', 1, fakeServer);
    letTheServerPutTheLastTakeOnAir(fakeServer, tenOClock);
    await screen.findByRole('button', { name: 'Atualizar' });

    // Act: five minutes later a yellow flag. The operator changes only the flag and
    // presses "Atualizar".
    moveThePageClockTo(fivePastTen);
    chooseOptionInDropdown('Bandeira', 'Amarela');
    await pressButtonAndWaitForCommand('Atualizar', 2, fakeServer);

    // Assert: the clock goes on from 17:34 (12:34 + 5:00 = 1 054 000 ms). The 12:34 typed
    // for the take was sent once and is not a pending change any more.
    expect(
      fakeServer.listCommandsReceived()[1],
      'after a take the typed time must not be sent again by "Atualizar"',
    ).toEqual({
      type: 'takeGraphic',
      graphicId: 'race-clock',
      layerId: 'clock',
      data: {
        sessionName: 'Enduro de Resistência — Bateria 1',
        state: 'yellow',
        clockMode: 'elapsed',
        referenceTimeMs: 1_054_000,
        referenceWallClockMs: Date.parse(fivePastTen),
        running: true,
      },
    });
    fakeServer.acceptLastCommand();
  });

  it('keeps the edit in the form when the server refuses, so the next press sends it again', async () => {
    // Arrange: the first heat on air, the flag changed to yellow, and an "Atualizar"
    // that the server refuses.
    const { fakeServer } = renderPanelAtTenOClockWithTheFirstHeatOnAir();
    chooseOptionInDropdown('Bandeira', 'Amarela');
    await pressButtonAndWaitForCommand('Atualizar', 1, fakeServer);
    fakeServer.refuseLastCommand({
      code: 'GRAPHIC_NOT_FOUND',
      message: 'O gráfico "race-clock" não está registrado.',
    });
    await screen.findByRole('alert');
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Atualizar' }),
        'the button must come back once the server has answered',
      ).toBeEnabled();
    });

    // Act: the operator presses "Atualizar" again without touching the form.
    await pressButtonAndWaitForCommand('Atualizar', 2, fakeServer);

    // Assert: the form still shows yellow, and the second command still asks for it.
    expect(
      screen.getByRole('combobox', { name: 'Bandeira' }),
      'a refused change must stay in the form',
    ).toHaveTextContent('Amarela');
    expect(
      fakeServer.listCommandsReceived()[1],
      'a refused change must still be pending on the next press',
    ).toEqual({
      type: 'takeGraphic',
      graphicId: 'race-clock',
      layerId: 'clock',
      data: {
        sessionName: 'Enduro de Resistência — Bateria 1',
        state: 'yellow',
        clockMode: 'elapsed',
        referenceTimeMs: 1_654_000,
        referenceWallClockMs: Date.parse(tenOClock),
        running: true,
      },
    });
    fakeServer.acceptLastCommand();
  });

  it('keeps a half-typed edit when someone else changes the clock, and lets the other fields follow the air', () => {
    // Arrange: the first heat on air, and the operator half-way through renaming the
    // session (typed, not sent).
    const { fakeServer } = renderPanelAtTenOClockWithTheFirstHeatOnAir();
    typeIntoField('Nome da sessão', 'Enduro de Resistência — Bateria 2');

    // Act: a second operator shows the red flag and stops the clock at 27:34; the server
    // tells this page about it.
    letASecondOperatorStopTheClockUnderTheRedFlag(fakeServer);

    // Assert: the typed session name was not wiped, and the fields the operator had not
    // touched now show what is on air.
    expect(
      screen.getByLabelText('Nome da sessão'),
      'an edit the operator has not sent yet must survive a change from the server',
    ).toHaveValue('Enduro de Resistência — Bateria 2');
    expect(
      screen.getByRole('combobox', { name: 'Bandeira' }),
      'an untouched flag must follow what is on air',
    ).toHaveTextContent('Vermelha');
    expect(
      screen.getByRole('switch', { name: 'Relógio correndo' }),
      'an untouched switch must follow what is on air',
    ).not.toBeChecked();
  });

  it("sends a half-typed edit without undoing another operator's change", async () => {
    // Arrange: the first heat on air, the operator half-way through renaming the session,
    // and a second operator who meanwhile showed the red flag and stopped the clock.
    const { fakeServer } = renderPanelAtTenOClockWithTheFirstHeatOnAir();
    typeIntoField('Nome da sessão', 'Enduro de Resistência — Bateria 2');
    letASecondOperatorStopTheClockUnderTheRedFlag(fakeServer);

    // Act: the first operator presses "Atualizar".
    await pressButtonAndWaitForCommand('Atualizar', 1, fakeServer);

    // Assert: the new session name goes out, and the red flag and the stopped clock of
    // the other operator are still there.
    expect(
      fakeServer.listCommandsReceived()[0],
      "the edit must go out without undoing the other operator's change",
    ).toEqual({
      type: 'takeGraphic',
      graphicId: 'race-clock',
      layerId: 'clock',
      data: {
        sessionName: 'Enduro de Resistência — Bateria 2',
        state: 'red',
        clockMode: 'elapsed',
        referenceTimeMs: 1_654_000,
        referenceWallClockMs: Date.parse(tenOClock),
        running: false,
      },
    });
    fakeServer.acceptLastCommand();
  });

  it('"Colocar no ar" sends the form as it stands while the clock is on air, typed time included', async () => {
    // Arrange: the first heat on air showing 27:34, and 20:00 typed in the form.
    const { fakeServer } = renderPanelAtTenOClockWithTheFirstHeatOnAir();
    typeIntoField('Tempo de referência (mm:ss)', '20:00');

    // Act: press "Colocar no ar", not "Atualizar".
    await pressButtonAndWaitForCommand('Colocar no ar', 1, fakeServer);

    // Assert: the take is the form, which was filled from what is on air, with the typed
    // 20:00 (1 200 000 ms).
    expect(
      fakeServer.listCommandsReceived()[0],
      '"Colocar no ar" must send every field as the form shows it',
    ).toEqual({
      type: 'takeGraphic',
      graphicId: 'race-clock',
      layerId: 'clock',
      data: {
        sessionName: 'Enduro de Resistência — Bateria 1',
        state: 'green',
        clockMode: 'elapsed',
        referenceTimeMs: 1_200_000,
        referenceWallClockMs: Date.parse(tenOClock),
        running: true,
      },
    });
    fakeServer.acceptLastCommand();
  });

  it('leaves the form alone when the on-air data cannot be read, and "Atualizar" sends the whole form', async () => {
    // Arrange: something sits on the clock layer under the race clock's name, but its
    // data has no clock fields (an older version of the graphic, say).
    const { fakeServer } = renderPanelAtTenOClock([
      buildRaceClockInstanceHoldingThisData(
        { sessionName: 'Enduro de Resistência — Bateria 1', state: 'green' },
        quarterToTen,
      ),
    ]);

    // Act: the operator changes only the flag and presses "Atualizar".
    chooseOptionInDropdown('Bandeira', 'Amarela');
    await pressButtonAndWaitForCommand('Atualizar', 1, fakeServer);

    // Assert: the form was not filled from the unreadable data (it still has the default
    // session name), and with nothing on air to keep, the command is the whole form.
    expect(
      screen.getByLabelText('Nome da sessão'),
      'unreadable on-air data must not be put into the form',
    ).toHaveValue('Enduro de Resistência');
    expect(
      fakeServer.listCommandsReceived()[0],
      'with unreadable on-air data "Atualizar" must send every field of the form',
    ).toEqual({
      type: 'takeGraphic',
      graphicId: 'race-clock',
      layerId: 'clock',
      data: {
        sessionName: 'Enduro de Resistência',
        state: 'yellow',
        clockMode: 'elapsed',
        referenceTimeMs: 0,
        referenceWallClockMs: Date.parse(tenOClock),
        running: false,
      },
    });
    fakeServer.acceptLastCommand();
  });
});
