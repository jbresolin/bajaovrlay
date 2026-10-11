/**
 * Take race clock panel: when someone else changes the clock (apps/control)
 *
 * What this module is for:
 *   Two people can have the control page open. Whatever one of them does to the clock
 *   reaches the other page as a message from the server, at any moment: in the middle
 *   of typing, while a field shows a message, or while a command waits for its answer.
 *   The panel must take the news in without losing what its own operator was doing.
 *
 * What these tests prove:
 *   - A change from someone else keeps the field this operator has edited and not sent,
 *     and puts the on-air value into the fields this operator has not touched.
 *   - The edit then goes out with "Atualizar" without undoing the other person's change.
 *   - Laps this operator erased, followed by someone else's clock that has no laps, do
 *     not block a later "Atualizar": the other changes are sent and no laps message shows.
 *   - When someone else takes the clock off air, the form is left exactly as it is.
 *   - While a command waits for the server's answer both buttons stay off, even if news
 *     from someone else arrives in between, so the clock cannot be sent twice.
 *   - A message under a badly typed field stays there when news from someone else arrives.
 *
 * What these tests deliberately do not cover:
 *   - This operator's own take or "Atualizar" coming back from the server:
 *     TakeRaceClockPanelUpdate.test.tsx.
 *   - A reconnect: the page then hears every slice again, which is the same road as the
 *     message used here.
 *   - A message under a field that someone else then corrects on air: the message stays
 *     until this operator's next press (written down in TakeRaceClockPanel.tsx).
 *   - Two real browsers and the real server; e2e/takeAndClear.e2e.ts uses one browser.
 */
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  type ControlPageOnFakeServer,
  renderOnControlPageConnectedToFakeServer,
} from '@/state/controlPageOnFakeServer.testSupport';
import { buildSlicesWithNothingOnAir } from '@/state/slicesLikeTheServerSends.testSupport';

import {
  buildRaceClockInstanceHoldingThisData,
  chooseOptionInDropdown,
  idOfTheRaceClockInstanceOnAir,
  pressButtonAndWaitForCommand,
  typeIntoField,
} from './operatingTheRaceClockForm.testSupport';
import { TakeRaceClockPanel } from './TakeRaceClockPanel';

// The Saturday of the endurance race, in Brasília time: the clock went on air at 9:45
// and everything below happens at 10:00, when it shows 27:34.
const quarterToTen = '2026-10-10T12:45:00.000Z';
const tenOClock = '2026-10-10T13:00:00.000Z';

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

/** Draws the panel at 10:00 on a connected page with the first heat on air since 9:45. */
function renderPanelAtTenOClockWithTheFirstHeatOnAir() {
  return renderOnControlPageConnectedToFakeServer(
    <TakeRaceClockPanel readCurrentTimeInMilliseconds={() => Date.parse(tenOClock)} />,
    {
      ...buildSlicesWithNothingOnAir(),
      instances: [buildRaceClockInstanceHoldingThisData(buildFirstHeatDataOnAir(), quarterToTen)],
    },
  );
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

/** What this page hears when a second operator presses "Limpar" on the clock layer. */
function letASecondOperatorTakeTheClockOffAir(fakeServer: FakeServer) {
  fakeServer.sendMessage({ type: 'slice', name: 'instances', slice: [] });
}

describe('the race clock panel when someone else changes the clock', () => {
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

    // Assert: only the new session name goes out. The flag, the switch and the time are
    // not in the command, so the red flag and the stopped clock of the other operator
    // cannot be undone by it.
    expect(
      fakeServer.listCommandsReceived()[0],
      "the edit must go out without undoing the other operator's change",
    ).toEqual({
      type: 'updateInstanceData',
      instanceId: idOfTheRaceClockInstanceOnAir,
      data: { sessionName: 'Enduro de Resistência — Bateria 2' },
    });
    fakeServer.acceptLastCommand();
  });

  it('sends a flag change after someone else put a clock without laps on air, although this operator had erased the laps', async () => {
    // Arrange: the first heat on air with 7 laps for the leader. The operator erases the
    // laps field (not sent). Then a second operator puts the clock on air again with no
    // laps at all, so the erased field and the air now agree: both are empty.
    const firstHeatWithSevenLaps = { ...buildFirstHeatDataOnAir(), lapsCompletedByLeader: 7 };
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(
      <TakeRaceClockPanel readCurrentTimeInMilliseconds={() => Date.parse(tenOClock)} />,
      {
        ...buildSlicesWithNothingOnAir(),
        instances: [buildRaceClockInstanceHoldingThisData(firstHeatWithSevenLaps, quarterToTen)],
      },
    );
    typeIntoField('Voltas do líder (opcional)', '');
    fakeServer.sendMessage({
      type: 'slice',
      name: 'instances',
      slice: [buildRaceClockInstanceHoldingThisData(buildFirstHeatDataOnAir(), tenOClock)],
    });

    // Act: the first operator changes the flag to yellow and presses "Atualizar".
    chooseOptionInDropdown('Bandeira', 'Amarela');
    await pressButtonAndWaitForCommand('Atualizar', 1, fakeServer);

    // Assert: the flag goes out, and the laps field shows no message: there are no laps
    // on air for "Atualizar" to fail to remove.
    expect(
      fakeServer.listCommandsReceived()[0],
      'the flag change must be sent; an empty laps field must not block it with no laps on air',
    ).toEqual({
      type: 'updateInstanceData',
      instanceId: idOfTheRaceClockInstanceOnAir,
      data: { state: 'yellow' },
    });
    expect(
      screen.queryByText('"Atualizar" não tira as voltas do ar. Use "Colocar no ar" para isso.'),
      'the laps message must not appear when no laps are on air',
    ).toBeNull();
    fakeServer.acceptLastCommand();
  });

  it('leaves the form as it is when someone else takes the clock off air', () => {
    // Arrange: the first heat on air, and the operator half-way through renaming the
    // session (typed, not sent).
    const { fakeServer } = renderPanelAtTenOClockWithTheFirstHeatOnAir();
    typeIntoField('Nome da sessão', 'Enduro de Resistência — Bateria 2');

    // Act: a second operator presses "Limpar" on the clock layer.
    letASecondOperatorTakeTheClockOffAir(fakeServer);

    // Assert: nothing in the form moved. The edit is still there, the untouched fields
    // still show what was on air (not the defaults), and "Atualizar" is gone, so the
    // operator can put the same clock back with "Colocar no ar".
    expect(
      screen.getByLabelText('Nome da sessão'),
      'an edit the operator has not sent yet must survive the clock leaving the air',
    ).toHaveValue('Enduro de Resistência — Bateria 2');
    expect(
      screen.getByRole('combobox', { name: 'Bandeira' }),
      'the flag must stay as it was, not go back to the default',
    ).toHaveTextContent('Verde');
    expect(
      screen.getByRole('switch', { name: 'Relógio correndo' }),
      'the switch must stay as it was, not go back to the default',
    ).toBeChecked();
    expect(
      screen.getByLabelText('Tempo de referência (mm:ss)'),
      'the time must stay as it was, not go back to zero',
    ).toHaveValue('27:34');
    expect(
      screen.queryByRole('button', { name: 'Atualizar' }),
      'there is nothing to update once the clock is off air',
    ).toBeNull();
  });

  it('keeps both buttons off while a command waits for its answer, even when news from someone else arrives', async () => {
    // Arrange: the first heat on air. The operator changes the flag to yellow and presses
    // "Atualizar"; the server has the command and has not answered yet.
    const { fakeServer } = renderPanelAtTenOClockWithTheFirstHeatOnAir();
    chooseOptionInDropdown('Bandeira', 'Amarela');
    await pressButtonAndWaitForCommand('Atualizar', 1, fakeServer);

    // Act: before the answer, the page hears that a second operator stopped the clock.
    letASecondOperatorStopTheClockUnderTheRedFlag(fakeServer);

    // Assert: both buttons are still off, so an impatient second click cannot send the
    // clock to air twice.
    expect(
      screen.getByRole('button', { name: 'Atualizar' }),
      '"Atualizar" must stay off until the server answers the command already sent',
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Colocar no ar' }),
      '"Colocar no ar" must stay off until the server answers the command already sent',
    ).toBeDisabled();
    // (Then the server answers, so no command is left waiting for its 5-second timeout
    // once the test is over.)
    fakeServer.acceptLastCommand();
  });

  it('keeps the message under a badly typed field when news from someone else arrives', async () => {
    // Arrange: the first heat on air. The operator types one hour as h:mm:ss and presses
    // "Atualizar", so the time field shows its message and nothing is sent.
    const { fakeServer } = renderPanelAtTenOClockWithTheFirstHeatOnAir();
    typeIntoField('Tempo de referência (mm:ss)', '1:00:00');
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }));
    await screen.findByText('Use minutos e segundos no formato mm:ss, por exemplo 12:30.');

    // Act: the page hears that a second operator stopped the clock.
    letASecondOperatorStopTheClockUnderTheRedFlag(fakeServer);

    // Assert: the badly typed time is still in the field, and so is the message that
    // explains it; the text must never be left there without its explanation.
    expect(
      screen.getByLabelText('Tempo de referência (mm:ss)'),
      'the text the operator typed must survive a change from the server',
    ).toHaveValue('1:00:00');
    expect(
      screen.getByText('Use minutos e segundos no formato mm:ss, por exemplo 12:30.'),
      'the message under the field must stay as long as the bad text does',
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText('Tempo de referência (mm:ss)'),
      'the field must still be marked invalid for screen readers',
    ).toBeInvalid();
  });
});
