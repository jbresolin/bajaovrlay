/**
 * "Edição rápida": when someone else changes the graphic on air (apps/control)
 *
 * What this module is for:
 *   Two people can have the control page open. Whatever one of them does to a graphic
 *   reaches the other page as a message from the server, at any moment: in the middle
 *   of typing, while a field shows a message, or while a command waits for its answer.
 *   The panel must take the news in without losing what its own operator was doing.
 *   These tests use the lower third fixture, a graphic the page has no code for, so they
 *   also prove that none of this is special to the race clock.
 *
 * What these tests prove:
 *   - A change from someone else keeps the field this operator has edited and not sent,
 *     and puts the on-air value into the fields this operator has not touched.
 *   - The edit then goes out with "Atualizar" without undoing the other person's change.
 *   - A field this operator cleared, followed by someone else's data that has no such
 *     field either, is no longer a pending change once the operator changes something
 *     else: "Atualizar" sends the other change and no null for the cleared field.
 *   - When someone else takes the graphic off air, the panel says so and the form goes.
 *   - While a command waits for the server's answer the button stays off, even if news
 *     from someone else arrives in between, so nothing can be sent twice.
 *   - A message under a badly typed field stays there when news from someone else arrives.
 *
 * What these tests deliberately do not cover:
 *   - This operator's own take or "Atualizar" coming back from the server:
 *     QuickEditPanelUpdate.test.tsx.
 *   - A reconnect: the page then hears every slice again, which is the same road as the
 *     message used here.
 *   - A message under a field that someone else then corrects on air: the message stays
 *     until this operator's next press (written down in QuickEditForm.tsx).
 *   - Two real browsers and the real server.
 */
import type { Instance } from '@bajaovrlay/shared';
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { buildLowerThirdDataForCar42 } from '@/features/schemaForm/lowerThirdFixtureSchema.testSupport';
import {
  chooseOptionInDropdown,
  flipSwitch,
  pressButton,
  typeIntoField,
} from '@/features/schemaForm/schemaFormOnTestPage.testSupport';
import type { ControlPageOnFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import { buildLowerThirdFixtureInstanceOnProgram } from '@/state/lowerThirdFixtureGraphic.testSupport';

import {
  pressButtonAndWaitForCommand,
  pressEditOnTheLayerRow,
  renderQuickEditPanelWithTheseInstancesOnAir,
} from './operatingTheQuickEditPanel.testSupport';

// The Saturday of the endurance race, in Brasília time: the interview's lower third went
// on air at 9:45 and everything below happens a few minutes later.
const quarterToTen = '2026-10-10T12:45:00.000Z';

const idOfTheLowerThirdOnAir = 'tarja-da-ana-souza';

type FakeServer = ControlPageOnFakeServer['fakeServer'];

/** The lower third on the "Tarja" layer since 9:45, holding this data. */
function buildLowerThirdInstanceHoldingThisData(lowerThirdData: Record<string, unknown>): Instance {
  return buildLowerThirdFixtureInstanceOnProgram({
    id: idOfTheLowerThirdOnAir,
    layerId: 'lower-third',
    resolvedData: lowerThirdData,
    takenAt: quarterToTen,
  });
}

/**
 * Draws the panel with the lower third of Ana Souza, captain of Baja UFPR's car 42, on
 * air, loaded into the panel with "Editar" on its "Camadas" row.
 */
function renderPanelWithTheLowerThirdOfCar42OnAir() {
  const controlPage = renderQuickEditPanelWithTheseInstancesOnAir([
    buildLowerThirdInstanceHoldingThisData(buildLowerThirdDataForCar42()),
  ]);
  pressEditOnTheLayerRow('Tarja');
  return controlPage;
}

/**
 * What this page hears when a second operator corrects the lower third in place: the
 * interviewee is from Poli USP, and the highlight frame goes off.
 */
function letASecondOperatorCorrectTheTeamAndTurnTheHighlightOff(fakeServer: FakeServer) {
  const dataAfterTheCorrection = {
    ...buildLowerThirdDataForCar42(),
    equipe: 'poli-usp',
    destaque: false,
  };
  fakeServer.sendMessage({
    type: 'slice',
    name: 'instances',
    slice: [buildLowerThirdInstanceHoldingThisData(dataAfterTheCorrection)],
  });
}

/** What this page hears when a second operator presses "Limpar" on the "Tarja" layer. */
function letASecondOperatorTakeTheLowerThirdOffAir(fakeServer: FakeServer) {
  fakeServer.sendMessage({ type: 'slice', name: 'instances', slice: [] });
}

describe('the quick edit panel when someone else changes the graphic on air', () => {
  it('keeps a half-typed edit when someone else changes the graphic, and lets the other fields follow the air', () => {
    // Arrange: the lower third on air, and the operator half-way through correcting the
    // name (typed, not sent).
    const { fakeServer } = renderPanelWithTheLowerThirdOfCar42OnAir();
    typeIntoField('Nome', 'Ana Souza Lima');

    // Act: a second operator corrects the team and turns the highlight off; the server
    // tells this page about it.
    letASecondOperatorCorrectTheTeamAndTurnTheHighlightOff(fakeServer);

    // Assert: the typed name was not wiped, and the fields the operator had not touched
    // now show what is on air.
    expect(
      screen.getByLabelText('Nome'),
      'an edit the operator has not sent yet must survive a change from the server',
    ).toHaveValue('Ana Souza Lima');
    expect(
      screen.getByRole('combobox', { name: 'Equipe' }),
      'an untouched dropdown must follow what is on air',
    ).toHaveTextContent('Poli USP');
    expect(
      screen.getByRole('switch', { name: 'Destaque' }),
      'an untouched switch must follow what is on air',
    ).not.toBeChecked();
  });

  it("sends a half-typed edit without undoing another operator's change", async () => {
    // Arrange: the lower third on air, the operator half-way through correcting the
    // name, and a second operator who meanwhile corrected the team and the highlight.
    const { fakeServer } = renderPanelWithTheLowerThirdOfCar42OnAir();
    typeIntoField('Nome', 'Ana Souza Lima');
    letASecondOperatorCorrectTheTeamAndTurnTheHighlightOff(fakeServer);

    // Act: the first operator presses "Atualizar".
    await pressButtonAndWaitForCommand('Atualizar', 1, fakeServer);

    // Assert: only the new name goes out. The team and the highlight are not in the
    // command, so the other operator's correction cannot be undone by it.
    expect(
      fakeServer.listCommandsReceived()[0],
      "the edit must go out without undoing the other operator's change",
    ).toEqual({
      type: 'updateInstanceData',
      instanceId: idOfTheLowerThirdOnAir,
      data: { nome: 'Ana Souza Lima' },
      takeTimeFieldKeys: [],
    });
    fakeServer.acceptLastCommand();
  });

  it('does not send a cleared field once someone else has taken that field off air, only the later change', async () => {
    // Arrange: the lower third on air with the role "Capitã". The operator clears the
    // role with "limpar" (not sent). Then a second operator changes the lower third so
    // that it has no role at all: the cleared field and the air now agree.
    const { fakeServer } = renderPanelWithTheLowerThirdOfCar42OnAir();
    pressButton('Limpar Cargo');
    const dataWithoutARole: Record<string, unknown> = buildLowerThirdDataForCar42();
    delete dataWithoutARole.cargo;
    fakeServer.sendMessage({
      type: 'slice',
      name: 'instances',
      slice: [buildLowerThirdInstanceHoldingThisData(dataWithoutARole)],
    });

    // Act: the first operator turns the highlight off and presses "Atualizar".
    flipSwitch('Destaque');
    await pressButtonAndWaitForCommand('Atualizar', 1, fakeServer);

    // Assert: only the highlight goes out. At the operator's next change the form works
    // out again which fields differ from what is on air; the role is blank in the form
    // and absent on air, so it is not a pending change any more and no null is sent.
    expect(
      fakeServer.listCommandsReceived()[0],
      'a cleared field that the air no longer has must not be sent; the later change must',
    ).toEqual({
      type: 'updateInstanceData',
      instanceId: idOfTheLowerThirdOnAir,
      data: { destaque: false },
      takeTimeFieldKeys: [],
    });
    fakeServer.acceptLastCommand();
  });

  it('says so and drops the half-typed edit when someone else takes the graphic off air', () => {
    // Arrange: the lower third on air, and the operator half-way through correcting the
    // name (typed, not sent).
    const { fakeServer } = renderPanelWithTheLowerThirdOfCar42OnAir();
    typeIntoField('Nome', 'Ana Souza Lima');

    // Act: a second operator presses "Limpar" on the "Tarja" layer.
    letASecondOperatorTakeTheLowerThirdOffAir(fakeServer);

    // Assert: one line saying so, and no form left: there is nothing on air to change,
    // and since BAJAOVRLAY-37 the panel puts nothing new up.
    expect(
      screen.getByText('O que você editava na camada Tarja saiu do ar.'),
      'the panel must say the lower third left the air',
    ).toBeVisible();
    expect(screen.queryByLabelText('Nome'), 'no form may be left to send').toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Atualizar' }),
      'there is nothing to update once the graphic is off air',
    ).toBeNull();
  });

  it('keeps the button off while a command waits for its answer, even when news from someone else arrives', async () => {
    // Arrange: the lower third on air. The operator picks FEI Baja as the team and
    // presses "Atualizar"; the server has the command and has not answered yet.
    const { fakeServer } = renderPanelWithTheLowerThirdOfCar42OnAir();
    chooseOptionInDropdown('Equipe', 'FEI Baja');
    await pressButtonAndWaitForCommand('Atualizar', 1, fakeServer);

    // Act: before the answer, the page hears that a second operator changed the lower third.
    letASecondOperatorCorrectTheTeamAndTurnTheHighlightOff(fakeServer);

    // Assert: the button is still off, so an impatient second click cannot send the same
    // change twice.
    expect(
      screen.getByRole('button', { name: 'Atualizar' }),
      '"Atualizar" must stay off until the server answers the command already sent',
    ).toBeDisabled();
    // (Then the server answers, so no command is left waiting for its 5-second timeout
    // once the test is over.)
    fakeServer.acceptLastCommand();
  });

  it('keeps the message under a badly typed field when news from someone else arrives', async () => {
    // Arrange: the lower third on air. The operator types one hour as h:mm:ss in the
    // time on air and presses "Atualizar", so the field shows its message and nothing
    // is sent.
    const { fakeServer } = renderPanelWithTheLowerThirdOfCar42OnAir();
    typeIntoField('Tempo no ar', '1:00:00');
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }));
    await screen.findByText(
      'Use minutos e segundos no formato mm:ss em "Tempo no ar", por exemplo 12:30.',
    );

    // Act: the page hears that a second operator changed the lower third.
    letASecondOperatorCorrectTheTeamAndTurnTheHighlightOff(fakeServer);

    // Assert: the badly typed time is still in the field, and so is the message that
    // explains it; the text must never be left there without its explanation.
    expect(
      screen.getByLabelText('Tempo no ar'),
      'the text the operator typed must survive a change from the server',
    ).toHaveValue('1:00:00');
    expect(
      screen.getByText(
        'Use minutos e segundos no formato mm:ss em "Tempo no ar", por exemplo 12:30.',
      ),
      'the message under the field must stay as long as the bad text does',
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText('Tempo no ar'),
      'the field must still be marked invalid for screen readers',
    ).toBeInvalid();
  });
});
