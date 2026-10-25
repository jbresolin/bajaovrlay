/**
 * The countdown's data (packages/graphics/countdown)
 *
 * What this module is for:
 *   countdownModel.ts checks the data `load` and `updateAction` receive (the layout, the
 *   session, the start as milliseconds since 1970, the waiting screen's two optional head
 *   lines) and merges a partial update into what is on air, never half-applying one.
 *
 * What these tests prove:
 *   - The enduro's card and its waiting board are accepted; a missing session, a start
 *     that is not a whole number, a layout of its own and an unknown field are refused in
 *     pt-BR naming the field.
 *   - A partial update moves the start and keeps the rest; a bad one changes nothing.
 *   - The head lines: a blank event or date line is left out, never drawn empty.
 *
 * What these tests deliberately do not cover:
 *   - The manifest's JSON Schema; countdownManifestDataAgreement.test.ts runs the same
 *     payloads through both.
 */
import { describe, expect, it } from 'vitest';

import {
  type CountdownData,
  listCountdownHeadLines,
  mergePartialUpdateIntoCountdownData,
  parseCompleteCountdownData,
} from './countdownModel.js';

/** The enduro's start: Sunday 30 March 2025, 10:00 in Brasília. */
const enduroStartsAtMs = Date.parse('2025-03-30T10:00:00.000-03:00');

/** The enduro's countdown as the waiting board shows it. */
function createEnduroWaitingBoardData(): CountdownData {
  return {
    layout: 'fullscreen',
    sessionName: 'Enduro de Resistência',
    startsAtMs: enduroStartsAtMs,
    eventLine: '30ª Competição Baja SAE Brasil',
    dateLine: 'domingo, 30 de março de 2025',
  };
}

describe('parseCompleteCountdownData', () => {
  const refusedData = [
    // A countdown with no session would count to nothing named.
    {
      name: 'refuses a missing session, naming it',
      data: { layout: 'card', startsAtMs: enduroStartsAtMs },
      expected: 'Falta o campo obrigatório "sessionName".',
    },
    // An ISO text is the form's date-time of a text field, not this field's milliseconds.
    {
      name: 'refuses a start written as text',
      data: { ...createEnduroWaitingBoardData(), startsAtMs: '2025-03-30T13:00:00.000Z' },
      expected: 'Valor inválido no campo "startsAtMs".',
    },
    // Two layouts only.
    {
      name: 'refuses a layout of its own',
      data: { ...createEnduroWaitingBoardData(), layout: 'faixa' },
      expected: 'Valor inválido no campo "layout".',
    },
    // A typo of a field name must not be ignored.
    {
      name: 'refuses an unknown field',
      data: { ...createEnduroWaitingBoardData(), eventName: 'Enduro' },
      expected: 'Campo desconhecido nos dados: "eventName".',
    },
  ];

  it('accepts the enduro’s waiting board and its card without head lines', () => {
    // Arrange: the board, and the card with neither line.
    const board = createEnduroWaitingBoardData();
    const card = {
      layout: 'card',
      sessionName: 'Enduro de Resistência',
      startsAtMs: enduroStartsAtMs,
    };

    // Act: check both.
    const boardCheck = parseCompleteCountdownData(board);
    const cardCheck = parseCompleteCountdownData(card);

    // Assert: both accepted as sent.
    expect(boardCheck, 'the board is valid').toEqual({ isValid: true, data: board });
    expect(cardCheck, 'the card is valid without the lines').toEqual({ isValid: true, data: card });
  });

  it.each(refusedData)('$name', ({ data, expected }) => {
    // Arrange: the data of this row.

    // Act: check it.
    const check = parseCompleteCountdownData(data);

    // Assert: refused with the pt-BR sentence.
    expect(check, 'refused, naming the field').toEqual({ isValid: false, problem: expected });
  });
});

describe('mergePartialUpdateIntoCountdownData', () => {
  it('moves the start and keeps everything else', () => {
    // Arrange: the board on air.
    const onAir = createEnduroWaitingBoardData();

    // Act: the schedule moves the start ten minutes later.
    const check = mergePartialUpdateIntoCountdownData(onAir, {
      startsAtMs: enduroStartsAtMs + 600_000,
    });

    // Assert: the new start, the rest as it was.
    expect(check, 'only the start changes').toEqual({
      isValid: true,
      data: { ...onAir, startsAtMs: enduroStartsAtMs + 600_000 },
    });
  });

  it('refuses a bad update and leaves the data on air as it was', () => {
    // Arrange: the board on air.
    const onAir = createEnduroWaitingBoardData();

    // Act: an update with a negative start.
    const check = mergePartialUpdateIntoCountdownData(onAir, { startsAtMs: -1 });

    // Assert: refused, and the board unchanged.
    expect(check.isValid, 'a negative start is refused').toBe(false);
    expect(onAir, 'nothing half-applied').toEqual(createEnduroWaitingBoardData());
  });
});

describe('listCountdownHeadLines', () => {
  it('leaves a blank line out', () => {
    // Arrange: the board with an event line of spaces and no date line.
    const data = { ...createEnduroWaitingBoardData(), eventLine: '   ', dateLine: undefined };

    // Act: list the head's lines.
    const headLines = listCountdownHeadLines(data);

    // Assert: neither is drawn.
    expect(headLines, 'no empty line in the head').toEqual({
      eventLine: undefined,
      dateLine: undefined,
    });
  });
});
