/**
 * "Edição rápida": the form following what is on air (apps/control)
 *
 * What this module is for:
 *   "Atualizar" sends the fields the operator changed, as `updateInstanceData`, and
 *   nothing else. For that to stay true the form must know two things at every moment:
 *   what is on air, and which fields hold a change the operator has not sent yet. These
 *   tests follow the race clock's form through the moments where that could go wrong.
 *
 * What these tests prove:
 *   - After a take the server accepted, the form shows what is now on air (the moment
 *     the server wrote included) and counts as untouched again: the next "Atualizar"
 *     does not send the fields typed for the take a second time.
 *   - After a refusal the operator's edit is still in the form and still goes out on
 *     the next press.
 *   - "Colocar no ar" always sends the form as it stands, every field of it.
 *   - A time typed and then put back to what the field showed counts as untouched.
 *   - A value on air that the form's rules refuse (an empty session name) blocks
 *     "Atualizar" with the field's message until it is corrected.
 *   - On-air data the form cannot show is not a dead end: the fields that could not be
 *     read are named above the form, with what each button does. "Atualizar" sends only
 *     what was changed, which the server refuses while a required field is missing on
 *     air; the refusal is shown, the edit is kept, and "Colocar no ar" then sends the
 *     whole form, which is complete.
 *
 * What these tests deliberately do not cover:
 *   - "Atualizar" after a reload and the form as the page loads: QuickEditPanel.test.tsx.
 *   - The form after an accepted "Atualizar" that stopped the clock or corrected its
 *     time, where the server carries the clock forward: QuickEditPanelClockUpdate.test.tsx.
 *   - The graphic changing or leaving the air through someone else:
 *     QuickEditPanelOtherOperator.test.tsx.
 *   - A field other than the time put back to its old value: the rule is react-hook-form's
 *     and is the same for every field.
 *   - The real server's order of messages (the changed slice, then "ok"), its writing of
 *     the moment, its laying the sent fields over the data on air and its refusing a
 *     result that lacks a required field; the fake server copies all four and
 *     apps/server's own tests prove them.
 */
import type { Instance } from '@bajaovrlay/shared';
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  chooseOptionInDropdown,
  flipSwitch,
  typeIntoField,
} from '@/features/schemaForm/schemaFormOnTestPage.testSupport';

import {
  buildRaceClockInstanceHoldingThisData,
  idOfTheRaceClockInstanceOnAir,
  letTheServerPutTheLastTakeOnAir,
  letTheServerRefuseTheLastUpdateForARequiredFieldMissingOnAir,
  pressButtonAndWaitForCommand,
  referenceMomentKindSelectorName,
  referenceMomentLabel,
  referenceTimeLabel,
  renderQuickEditPanelWithTheseInstancesOnAir,
  waitUntilButtonIsOnAgain,
} from './operatingTheQuickEditPanel.testSupport';

// The Saturday of the endurance race, in Brasília time: the clock went on air at 9:45
// and the operator presses a button at 10:00.
const quarterToTen = '2026-10-10T12:45:00.000Z';
const tenOClock = '2026-10-10T13:00:00.000Z';

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

/** The first heat as an instance on the clock layer, on air since 9:45. */
function buildFirstHeatInstanceOnAir(): Instance {
  return buildRaceClockInstanceHoldingThisData(buildFirstHeatDataOnAir(), quarterToTen);
}

/** Draws the panel with the first heat on air since 9:45. */
function renderPanelWithTheFirstHeatOnAir() {
  return renderQuickEditPanelWithTheseInstancesOnAir([buildFirstHeatInstanceOnAir()]);
}

describe('the quick edit form following what is on air', () => {
  it('shows what the server put on air after an accepted "Colocar no ar", and a later flag change sends the flag alone', async () => {
    // Arrange: nothing on air. The operator fills the form for the first heat and
    // presses "Colocar no ar"; the server puts it on air at 10:00, writing that moment
    // as the reference, and accepts.
    const { fakeServer } = renderQuickEditPanelWithTheseInstancesOnAir([]);
    typeIntoField('Nome da sessão', 'Enduro de Resistência — Bateria 1');
    chooseOptionInDropdown('Bandeira', 'Verde');
    flipSwitch('Relógio correndo');
    typeIntoField(referenceTimeLabel, '12:34');
    await pressButtonAndWaitForCommand('Colocar no ar', 1, fakeServer);
    letTheServerPutTheLastTakeOnAir(fakeServer, idOfTheRaceClockInstanceOnAir, tenOClock);
    await screen.findByRole('button', { name: 'Atualizar' });
    await waitUntilButtonIsOnAgain('Atualizar');
    const kindOfTheReferenceMomentAfterTheTake = screen.getByRole('combobox', {
      name: referenceMomentKindSelectorName,
    }).textContent;
    const referenceMomentShownAfterTheTake =
      screen.getByLabelText<HTMLInputElement>(referenceMomentLabel).value;

    // Act: a yellow flag comes out; the operator changes only the flag and presses "Atualizar".
    chooseOptionInDropdown('Bandeira', 'Amarela');
    await pressButtonAndWaitForCommand('Atualizar', 2, fakeServer);

    // Assert: the form took the moment the server wrote, as a typed value. And the
    // update holds only the flag: the session name, the switch and the 12:34 typed for
    // the take were sent once and are not pending changes any more.
    expect(
      kindOfTheReferenceMomentAfterTheTake,
      'after the take the reference moment is a number on air, so it must show as a typed value',
    ).toBe('Valor digitado');
    expect(
      referenceMomentShownAfterTheTake,
      'the form must show the moment the server wrote at the take',
    ).toBe(String(Date.parse(tenOClock)));
    expect(
      fakeServer.listCommandsReceived()[1],
      'after a take the fields typed for it must not be sent again by "Atualizar"',
    ).toEqual({
      type: 'updateInstanceData',
      instanceId: idOfTheRaceClockInstanceOnAir,
      data: { state: 'yellow' },
      takeTimeFieldKeys: [],
    });
    fakeServer.acceptLastCommand();
  });

  it('keeps the edit in the form when the server refuses, so the next press sends it again', async () => {
    // Arrange: the first heat on air, the flag changed to yellow, and an "Atualizar"
    // that the server refuses.
    const { fakeServer } = renderPanelWithTheFirstHeatOnAir();
    chooseOptionInDropdown('Bandeira', 'Amarela');
    await pressButtonAndWaitForCommand('Atualizar', 1, fakeServer);
    fakeServer.refuseLastCommand({
      code: 'INVALID_GRAPHIC_DATA',
      message: 'O gráfico "race-clock" não aceita o campo "state".',
    });
    await screen.findByRole('alert');
    await waitUntilButtonIsOnAgain('Atualizar');

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
      type: 'updateInstanceData',
      instanceId: idOfTheRaceClockInstanceOnAir,
      data: { state: 'yellow' },
      takeTimeFieldKeys: [],
    });
    fakeServer.acceptLastCommand();
  });

  it('"Colocar no ar" sends the whole form as it stands while the clock is on air', async () => {
    // Arrange: the first heat on air, and 20:00 typed in the form.
    const { fakeServer } = renderPanelWithTheFirstHeatOnAir();
    typeIntoField(referenceTimeLabel, '20:00');

    // Act: press "Colocar no ar", not "Atualizar".
    await pressButtonAndWaitForCommand('Colocar no ar', 1, fakeServer);

    // Assert: the take is the form, which was filled from what is on air, with the typed
    // 20:00 (1 200 000 ms). What could surprise: the reference moment is the 9:45 the
    // form took from the air, as a typed number, so a running clock would count 20:00
    // from 9:45. To restart it from the press the operator chooses "Momento da entrada
    // no ar" for that field first.
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
        referenceWallClockMs: Date.parse(quarterToTen),
        running: true,
      },
      takeTimeFieldKeys: [],
    });
    fakeServer.acceptLastCommand();
  });

  it('counts a time typed and then put back as untouched, so "Atualizar" sends no time', async () => {
    // Arrange: the first heat on air; the form holds the 12:34 on air (its time field
    // shows the time on screen instead while untouched). The operator types 20:00, thinks
    // again, and types the 12:34 the form held before. The flag is changed to yellow as
    // well, so that there is something to send.
    const { fakeServer } = renderPanelWithTheFirstHeatOnAir();
    typeIntoField(referenceTimeLabel, '20:00');
    typeIntoField(referenceTimeLabel, '12:34');
    chooseOptionInDropdown('Bandeira', 'Amarela');

    // Act: press "Atualizar".
    await pressButtonAndWaitForCommand('Atualizar', 1, fakeServer);

    // Assert: the time field counts as untouched, so the command carries the flag and
    // no time.
    expect(
      fakeServer.listCommandsReceived()[0],
      'a field put back to the value the form held must count as untouched',
    ).toEqual({
      type: 'updateInstanceData',
      instanceId: idOfTheRaceClockInstanceOnAir,
      data: { state: 'yellow' },
      takeTimeFieldKeys: [],
    });
    fakeServer.acceptLastCommand();
  });

  it('shows the field message and sends nothing when the session name on air is empty', async () => {
    // Arrange: a clock on air with an empty session name, which the graphic allows and
    // the form's rules do not (put there by another tool, say). The operator changes
    // only the flag.
    const { fakeServer } = renderQuickEditPanelWithTheseInstancesOnAir([
      buildRaceClockInstanceHoldingThisData(
        { ...buildFirstHeatDataOnAir(), sessionName: '' },
        quarterToTen,
      ),
    ]);
    chooseOptionInDropdown('Bandeira', 'Amarela');

    // Act: press "Atualizar".
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }));

    // Assert: the untouched session name is still checked. Its message is shown, and the
    // yellow flag does not go out until the operator types a name.
    expect(
      await screen.findByText('O campo "Nome da sessão" é obrigatório.'),
      'the empty session name taken from the air must be explained under its field',
    ).toBeInTheDocument();
    expect(
      fakeServer.listCommandsReceived(),
      'nothing may be sent while a field holds a value the form refuses',
    ).toEqual([]);
  });

  it('names the fields it could not read from the air, shows the refusal of "Atualizar", and "Colocar no ar" sends the whole form', async () => {
    // Arrange: an instance of the race clock whose data has no clock fields at all (an
    // older version of the graphic, say). The operator changes only the flag.
    const instanceWithoutClockFields = buildRaceClockInstanceHoldingThisData(
      { sessionName: 'Enduro de Resistência — Bateria 1', state: 'green' },
      quarterToTen,
    );
    const { fakeServer } = renderQuickEditPanelWithTheseInstancesOnAir([
      instanceWithoutClockFields,
    ]);
    const warningAboveTheForm = screen.getByText(/não puderam ser lidos/).textContent;
    chooseOptionInDropdown('Bandeira', 'Amarela');

    // Act: press "Atualizar". The server lays the flag over what is on air, finds the
    // clock mode still missing and refuses, as the real one does. Then press "Colocar no ar".
    await pressButtonAndWaitForCommand('Atualizar', 1, fakeServer);
    letTheServerRefuseTheLastUpdateForARequiredFieldMissingOnAir(
      fakeServer,
      instanceWithoutClockFields,
    );
    const refusalNextToTheButtons = (await screen.findByRole('alert')).textContent;
    await waitUntilButtonIsOnAgain('Colocar no ar');
    await pressButtonAndWaitForCommand('Colocar no ar', 2, fakeServer);

    // Assert: the form showed what it could read and said which four required fields it
    // could not, by their labels, and what each button does about it.
    expect(
      screen.getByLabelText('Nome da sessão'),
      'a field that can be read must be shown although others cannot',
    ).toHaveValue('Enduro de Resistência — Bateria 1');
    expect(
      warningAboveTheForm,
      'the panel must name the fields it could not read and say truthfully what the two buttons do',
    ).toBe(
      `Estes campos do que está no ar não puderam ser lidos e aparecem com o valor inicial: Modo do relógio, ${referenceTimeLabel}, ${referenceMomentLabel}, Relógio correndo. "Atualizar" envia só o que você alterar, e o servidor recusa enquanto faltar um campo obrigatório no ar; "Colocar no ar" envia o formulário inteiro e substitui o que está no ar.`,
    );
    // The update carried the flag alone: the server is never sent a value the operator
    // has not seen and changed. That is why it was refused, and the operator is told so.
    expect(
      fakeServer.listCommandsReceived()[0],
      'a field that could not be read and was not touched must not be sent by "Atualizar"',
    ).toEqual({
      type: 'updateInstanceData',
      instanceId: idOfTheRaceClockInstanceOnAir,
      data: { state: 'yellow' },
      takeTimeFieldKeys: [],
    });
    expect(
      refusalNextToTheButtons,
      "the server's refusal of the incomplete result must be shown next to the buttons",
    ).toBe(
      'Dados inválidos para o gráfico "race-clock": o campo "clockMode" é obrigatório e não foi enviado.',
    );
    // The way out: the take carries every field, the yellow flag the operator chose and
    // the starting values of the fields that could not be read, so nothing is missing
    // and the real server accepts it. The reference moment starts as in an empty form,
    // "Momento da entrada no ar", so the server writes the moment of this take: the
    // page never sends the manifest's default 0 as the moment a clock counts from.
    expect(
      fakeServer.listCommandsReceived()[1],
      '"Colocar no ar" must send the whole form, with the edit the refused update kept',
    ).toEqual({
      type: 'takeGraphic',
      graphicId: 'race-clock',
      layerId: 'clock',
      data: {
        sessionName: 'Enduro de Resistência — Bateria 1',
        state: 'yellow',
        clockMode: 'elapsed',
        referenceTimeMs: 0,
        running: false,
      },
      takeTimeFieldKeys: ['referenceWallClockMs'],
    });
    fakeServer.acceptLastCommand();
  });
});
