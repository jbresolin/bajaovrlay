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
 *   - After an "Atualizar" the server accepted, the form shows what is now on air and
 *     counts as untouched again, so the next "Atualizar" does not send the fields sent
 *     before.
 *   - After a refusal the operator's edit is still in the form and still goes out on
 *     the next press.
 *   - A time typed and then put back to what the field showed counts as untouched.
 *   - A value on air that the form's rules refuse (an empty session name) blocks
 *     "Atualizar" with the field's message until it is corrected.
 *   - On-air data the form cannot show is named above the form, with what "Atualizar"
 *     does. "Atualizar" sends only what was changed, which the server refuses while a
 *     required field is missing on air; the refusal is shown and the edit is kept.
 *     (Until BAJAOVRLAY-37 "Colocar no ar" then sent the whole form; the panel puts
 *     nothing new up any more, so such an instance is cleared and its item taken again.)
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
  typeIntoField,
} from '@/features/schemaForm/schemaFormOnTestPage.testSupport';

import {
  buildRaceClockInstanceHoldingThisData,
  idOfTheRaceClockInstanceOnAir,
  letTheServerApplyTheLastUpdate,
  letTheServerRefuseTheLastUpdateForARequiredFieldMissingOnAir,
  pressButtonAndWaitForCommand,
  pressEditOnTheLayerRow,
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
  const controlPage = renderQuickEditPanelWithTheseInstancesOnAir([buildFirstHeatInstanceOnAir()]);
  pressEditOnTheLayerRow('Relógio');
  return controlPage;
}

describe('the quick edit form following what is on air', () => {
  it('counts as untouched after an accepted "Atualizar", so a later flag change sends the flag alone', async () => {
    // Arrange: the first heat on air and loaded. The operator retypes the title and
    // presses "Atualizar"; the server applies it at 10:00 and accepts.
    const { fakeServer } = renderPanelWithTheFirstHeatOnAir();
    typeIntoField('Título', 'Enduro de Resistência — Bateria 1 (reinício)');
    await pressButtonAndWaitForCommand('Atualizar', 1, fakeServer);
    letTheServerApplyTheLastUpdate(fakeServer, buildFirstHeatInstanceOnAir(), tenOClock);
    await waitUntilButtonIsOnAgain('Atualizar');

    // Act: a yellow flag comes out; the operator changes only the flag and presses "Atualizar".
    chooseOptionInDropdown('Bandeira', 'Amarela');
    await pressButtonAndWaitForCommand('Atualizar', 2, fakeServer);

    // Assert: the form shows the title now on air, and the second update holds only the
    // flag: the title was sent once and is not a pending change any more.
    expect(
      screen.getByLabelText('Título'),
      'the form must show what the server now holds',
    ).toHaveValue('Enduro de Resistência — Bateria 1 (reinício)');
    expect(
      fakeServer.listCommandsReceived()[1],
      'after an accepted update the fields it carried must not be sent again',
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
    // the form's rules do not (put there by another tool, say). The operator loads it
    // with "Editar" and changes only the flag.
    const { fakeServer } = renderQuickEditPanelWithTheseInstancesOnAir([
      buildRaceClockInstanceHoldingThisData(
        { ...buildFirstHeatDataOnAir(), sessionName: '' },
        quarterToTen,
      ),
    ]);
    pressEditOnTheLayerRow('Relógio');
    chooseOptionInDropdown('Bandeira', 'Amarela');

    // Act: press "Atualizar".
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }));

    // Assert: the untouched session name is still checked. Its message is shown, and the
    // yellow flag does not go out until the operator types a name.
    expect(
      await screen.findByText('O campo "Título" é obrigatório.'),
      'the empty session name taken from the air must be explained under its field',
    ).toBeInTheDocument();
    expect(
      fakeServer.listCommandsReceived(),
      'nothing may be sent while a field holds a value the form refuses',
    ).toEqual([]);
  });

  it('names the fields it could not read from the air, shows the refusal of "Atualizar", and keeps the edit', async () => {
    // Arrange: an instance of the race clock whose data has no clock fields at all (an
    // older version of the graphic, say). The operator loads it with "Editar" and changes
    // only the flag.
    const instanceWithoutClockFields = buildRaceClockInstanceHoldingThisData(
      { sessionName: 'Enduro de Resistência — Bateria 1', state: 'green' },
      quarterToTen,
    );
    const { fakeServer } = renderQuickEditPanelWithTheseInstancesOnAir([
      instanceWithoutClockFields,
    ]);
    pressEditOnTheLayerRow('Relógio');
    const warningAboveTheForm = screen.getByText(/não puderam ser lidos/).textContent;
    chooseOptionInDropdown('Bandeira', 'Amarela');

    // Act: press "Atualizar". The server lays the flag over what is on air, finds the
    // clock mode still missing and refuses, as the real one does.
    await pressButtonAndWaitForCommand('Atualizar', 1, fakeServer);
    letTheServerRefuseTheLastUpdateForARequiredFieldMissingOnAir(
      fakeServer,
      instanceWithoutClockFields,
    );
    const refusalNextToTheButton = (await screen.findByRole('alert')).textContent;

    // Assert: the form showed what it could read and said which four required fields it
    // could not, by their labels, and what "Atualizar" does about it.
    expect(
      screen.getByLabelText('Título'),
      'a field that can be read must be shown although others cannot',
    ).toHaveValue('Enduro de Resistência — Bateria 1');
    expect(
      warningAboveTheForm,
      'the panel must name the fields it could not read and say truthfully what "Atualizar" does',
    ).toBe(
      `Estes campos do que está no ar não puderam ser lidos e aparecem com o valor inicial: Modo do relógio, ${referenceTimeLabel}, ${referenceMomentLabel}, Relógio correndo. "Atualizar" envia só o que você alterar; preencha estes campos para enviá-los.`,
    );
    // The update carried the flag alone: the server is never sent a value the operator
    // has not seen and changed. That is why it was refused, and the operator is told so.
    expect(
      fakeServer.listCommandsReceived(),
      'a field that could not be read and was not touched must not be sent by "Atualizar"',
    ).toEqual([
      {
        type: 'updateInstanceData',
        instanceId: idOfTheRaceClockInstanceOnAir,
        data: { state: 'yellow' },
        takeTimeFieldKeys: [],
      },
    ]);
    expect(
      refusalNextToTheButton,
      "the server's refusal of the incomplete result must be shown next to the button",
    ).toBe(
      'Dados inválidos para o gráfico "race-clock": o campo "clockMode" é obrigatório e não foi enviado.',
    );
    expect(
      screen.getByRole('combobox', { name: 'Bandeira' }),
      'the edit the refused update carried must still be in the form',
    ).toHaveTextContent('Amarela');
  });
});
