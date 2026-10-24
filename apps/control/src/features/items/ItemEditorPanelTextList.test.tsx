/**
 * Item editor panel: a list of texts sent on air with "Atualizar no ar" (apps/control)
 *
 * What this module is for:
 *   The message ticker shows the event's announcements, one per page, and the operator
 *   adds one during the event (BAJAOVRLAY-23): open the ticker's item, "Adicionar
 *   mensagem", type it, "Atualizar no ar". The list is a field like any other, so the
 *   press saves the item with the whole new list and then sends the new list to the
 *   ticker on air, which redraws its pages in place.
 *
 * What these tests prove:
 *   - A third message added and typed is saved as the item's whole list of three, then
 *     sent on air as the list of three, the other fields untouched.
 *   - A message too long for the bar stops the press, with the reason under the list,
 *     and nothing is sent.
 *
 * What these tests deliberately do not cover:
 *   - Adding, removing and reordering on screen; SchemaFormFieldsTextList.test.tsx.
 *   - What the ticker does with the new list on air; packages/graphics/message-ticker.
 */
import type { Graphic, Item } from '@bajaovrlay/shared';
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  buildMessageTickerFixtureDataSchema,
  buildTwoEnduroMorningMessages,
} from '@/features/schemaForm/messageTickerFixtureSchema.testSupport';
import { pressButton } from '@/features/schemaForm/schemaFormOnTestPage.testSupport';

import {
  idOfTheInstanceTakenFromTheItem,
  momentTheItemWasTaken,
  pressUpdateOnAirAndWaitForCommand,
  renderItemEditorPanelOnFakeServerWithSlices,
  waitForCommandsReceived,
} from './itemEditorOnFakeServer.testSupport';
import {
  buildInstanceTakenFromItem,
  buildSlicesWithTheRaceClockAndTheLowerThird,
  idOfTheMainSessionRundown,
} from './itemsLikeTheEditorSaves.testSupport';

const idOfTheMorningAnnouncementsItem = '9c2e4a61-5d3b-4f7e-8a19-6b0d2c4e8f13';

/** The message ticker as the server registers it, with the fixture's data schema. */
function buildMessageTickerGraphic(): Graphic {
  return {
    id: 'message-ticker',
    manifest: {
      id: 'baja-message-ticker',
      name: 'Letreiro de avisos',
      main: 'message-ticker.js',
      schema: buildMessageTickerFixtureDataSchema(),
    },
    defaultLayerId: 'ticker',
    category: 'ticker',
    thumbnailUrl: null,
    defaultFields: {},
  };
}

/** The morning's announcements on the ticker layer: the label and two messages. */
function buildMorningAnnouncementsItem(): Item {
  return {
    id: idOfTheMorningAnnouncementsItem,
    home: { kind: 'rundown', rundownId: idOfTheMainSessionRundown },
    order: 0,
    graphicId: 'message-ticker',
    layerId: 'ticker',
    fields: {
      label: { kind: 'literal', value: 'AVISO' },
      messages: { kind: 'literal', value: buildTwoEnduroMorningMessages() },
    },
    label: 'Avisos da manhã',
    color: 'info',
    notes: '',
  };
}

/** Draws the editor for the morning's announcements, which are on air. */
function renderEditorForTheAnnouncementsOnAir() {
  const itemOnAir = buildMorningAnnouncementsItem();
  const slicesWithTheClockAndTheLowerThird = buildSlicesWithTheRaceClockAndTheLowerThird();
  return renderItemEditorPanelOnFakeServerWithSlices(itemOnAir, {
    ...slicesWithTheClockAndTheLowerThird,
    graphics: [...slicesWithTheClockAndTheLowerThird.graphics, buildMessageTickerGraphic()],
    items: [itemOnAir],
    instances: [
      buildInstanceTakenFromItem({
        id: idOfTheInstanceTakenFromTheItem,
        item: itemOnAir,
        layerId: 'ticker',
        target: 'program',
        takenAt: momentTheItemWasTaken,
      }),
    ],
  });
}

describe('"Atualizar no ar" with a list of messages', () => {
  it('saves and sends the whole new list after a third message is added', async () => {
    // Arrange: the morning's announcements on air, their item open in the editor.
    const { fakeServer } = renderEditorForTheAnnouncementsOnAir();

    // Act: add the awards announcement, press "Atualizar no ar", accept the save.
    pressButton('Adicionar mensagem');
    fireEvent.change(screen.getByRole('textbox', { name: 'Mensagem 3' }), {
      target: { value: 'Premiação às 18h00 no palco' },
    });
    await pressUpdateOnAirAndWaitForCommand(1, fakeServer);
    fakeServer.acceptLastCommand();
    await waitForCommandsReceived(2, fakeServer);

    // Assert: the item stores the three messages, and the ticker on air gets the three.
    const threeMessages = [...buildTwoEnduroMorningMessages(), 'Premiação às 18h00 no palco'];
    expect(
      fakeServer.listCommandsReceived(),
      'the press must save the new list and then send it on air',
    ).toEqual([
      {
        type: 'updateItemFields',
        itemId: idOfTheMorningAnnouncementsItem,
        fields: { messages: { kind: 'literal', value: threeMessages } },
      },
      {
        type: 'updateInstanceData',
        instanceId: idOfTheInstanceTakenFromTheItem,
        data: { messages: threeMessages },
        takeTimeFieldKeys: [],
      },
    ]);
  });

  it('sends nothing while a message is too long for the bar, and says why', async () => {
    // Arrange: the morning's announcements on air, their item open in the editor.
    const { fakeServer } = renderEditorForTheAnnouncementsOnAir();

    // Act: add a message over the 70 characters the bar holds, and press the button.
    pressButton('Adicionar mensagem');
    fireEvent.change(screen.getByRole('textbox', { name: 'Mensagem 3' }), {
      target: {
        value: 'Atenção equipes: o reabastecimento fecha às 13h30 e reabre após a bandeira verde',
      },
    });
    pressButton('Atualizar no ar');

    // Assert: the reason under the list, and no command.
    expect(
      await screen.findByText('Mensagem 3: no máximo 70 caracteres (tem 80).'),
      'the reason gives the line and the limit',
    ).toBeInTheDocument();
    expect(fakeServer.listCommandsReceived(), 'nothing may be sent').toEqual([]);
  });
});
