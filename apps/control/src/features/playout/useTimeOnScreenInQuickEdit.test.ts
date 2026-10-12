/**
 * Keeping the time on screen up to date for "Edição rápida" (apps/control)
 *
 * What this module is for:
 *   While a clock is on air and the operator has not touched its time, the time field of
 *   "Edição rápida" shows the time the screen shows right now. useTimeOnScreenInQuickEdit
 *   is the part that knows when: it hands the form the text for that field, works it out
 *   again once a second while the clock runs, and stops as soon as nobody needs a new
 *   text, so an idle page does no work and an operator never types into a moving text.
 *
 * What these tests prove:
 *   - For a running clock the text is the time on screen now, and a second later the
 *     next second.
 *   - No timer runs for a held clock, for a graphic that is off air, for a graphic that
 *     is not a clock, once the operator changed the time, or while the cursor is in the
 *     time field; the timer comes back when the cursor leaves.
 *   - There is no text at all (the field shows what the form holds) when the graphic is
 *     off air or is not a clock, when the data on air is not a clock reading, and when
 *     the operator changed the time, the moment it belongs to, or who fills that moment.
 *   - "Now" is read through the function handed in, and nowhere else.
 *
 * What these tests deliberately do not cover:
 *   - The sum and the rounding: timeOnScreenOfClockOnAir.test.ts and packages/shared.
 *   - The field on the page, with the cursor in it and "Atualizar" pressed:
 *     QuickEditPanelTimeOnScreen.test.tsx.
 *   - A page whose clock disagrees with the server's: the shared "now" this hook reads
 *     by default is tested in packages/shared/src/clock.
 */
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { SchemaFormDirtyFields } from '@/features/schemaForm';

import type { ClockFieldKeysOfGraphic } from './clockFieldsOfGraphic';
import { useTimeOnScreenInQuickEdit } from './useTimeOnScreenInQuickEdit';

// The Saturday of the endurance race, in Brasília time: the clock went on air at 9:45
// and it is now 10:00, fifteen minutes later.
const quarterToTen = '2026-10-10T12:45:00.000Z';
const tenOClock = '2026-10-10T13:00:00.000Z';

// The keys of a pit-stop countdown, a clock that shares no key with the race clock.
const keysOfThePitStopCountdown: ClockFieldKeysOfGraphic = {
  timeFieldKey: 'tempoMs',
  referenceMomentFieldKey: 'momentoDaLeituraMs',
  runningFieldKey: 'contando',
  clockModeFieldKey: 'sentido',
};

const nothingChangedByTheOperator: SchemaFormDirtyFields = {};

/** A stopwatch on air: counting up from 12:34 since 9:45, or held at 12:34. */
function buildStopwatchDataOnAir(isCounting: boolean): Record<string, unknown> {
  return {
    equipe: 'Baja UFPR',
    tempoMs: 754_000,
    momentoDaLeituraMs: Date.parse(quarterToTen),
    contando: isCounting,
    sentido: 'elapsed',
  };
}

/** Makes time stand still at 10:00 until the test moves it. */
function holdThePageClockAtTenOClock(): void {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(tenOClock));
}

/** Moves the page's clock forward and lets React draw what the timers asked for. */
function letTimePass(milliseconds: number): void {
  act(() => {
    vi.advanceTimersByTime(milliseconds);
  });
}

describe('useTimeOnScreenInQuickEdit, for a clock that runs', () => {
  it('gives the time on screen now for the time field, and the next second a second later', () => {
    // Arrange: 10:00 on the page; a stopwatch counting from 12:34 since 9:45.
    holdThePageClockAtTenOClock();
    const { result } = renderHook(() =>
      useTimeOnScreenInQuickEdit({
        clockFieldKeys: keysOfThePitStopCountdown,
        dataOnAir: buildStopwatchDataOnAir(true),
        fieldsTheOperatorChanged: nothingChangedByTheOperator,
      }),
    );
    const textAtTenOClock = result.current?.text;

    // Act: one second passes.
    letTimePass(1000);

    // Assert: the text is for the time field, and it moved on with the screen.
    expect(result.current?.fieldKey, 'the text must be meant for the clock’s time field').toBe(
      'tempoMs',
    );
    expect(textAtTenOClock, 'fifteen minutes after 12:34 the screen shows 27:34').toBe('27:34');
    expect(result.current?.text, 'one second later the screen shows 27:35').toBe('27:35');
  });

  it('stops its timer while the cursor is in the time field and starts it again when the cursor leaves', () => {
    // Arrange: 10:00 on the page; a stopwatch counting from 12:34 since 9:45.
    holdThePageClockAtTenOClock();
    const { result } = renderHook(() =>
      useTimeOnScreenInQuickEdit({
        clockFieldKeys: keysOfThePitStopCountdown,
        dataOnAir: buildStopwatchDataOnAir(true),
        fieldsTheOperatorChanged: nothingChangedByTheOperator,
      }),
    );
    const timersBeforeTheCursor = vi.getTimerCount();

    // Act: the cursor enters the field, three seconds pass, and the cursor leaves.
    act(() => result.current?.onCursorEnteredOrLeftTheField(true));
    const timersWithTheCursorInTheField = vi.getTimerCount();
    letTimePass(3000);
    act(() => result.current?.onCursorEnteredOrLeftTheField(false));

    // Assert: one timer, none, one again; and the text caught up at once.
    expect(timersBeforeTheCursor, 'a running clock on air needs one timer').toBe(1);
    expect(
      timersWithTheCursorInTheField,
      'no timer may run while the operator is in the time field',
    ).toBe(0);
    expect(vi.getTimerCount(), 'the timer must be back once the cursor left').toBe(1);
    expect(
      result.current?.text,
      'when the cursor leaves, the text must be the time on screen at that moment',
    ).toBe('27:37');
  });

  it('reads "now" through the function it was handed', () => {
    // Arrange: a page whose own clock is somewhere else entirely (the test machine's
    // real clock), and a "now" handed in that says 10:00:20.
    const readTwentySecondsPastTen = () => Date.parse(tenOClock) + 20_000;

    // Act: draw once.
    const { result } = renderHook(() =>
      useTimeOnScreenInQuickEdit({
        clockFieldKeys: keysOfThePitStopCountdown,
        dataOnAir: buildStopwatchDataOnAir(true),
        fieldsTheOperatorChanged: nothingChangedByTheOperator,
        readNowMs: readTwentySecondsPastTen,
      }),
    );

    // Assert: 12:34 plus fifteen minutes and twenty seconds.
    expect(
      result.current?.text,
      'the text must be worked out from the "now" handed in, not from another clock',
    ).toBe('27:54');
  });
});

describe('useTimeOnScreenInQuickEdit, when there is nothing to keep up to date', () => {
  const formsWithoutAMovingText = [
    // A held clock shows its reading; the text is there but can never change.
    {
      name: 'gives the reading of a held clock and runs no timer',
      clockFieldKeys: keysOfThePitStopCountdown,
      dataOnAir: buildStopwatchDataOnAir(false),
      fieldsTheOperatorChanged: nothingChangedByTheOperator,
      expectedText: '12:34',
    },
    // Off air there is no screen to follow: the form keeps what the operator prepared.
    {
      name: 'gives no text and runs no timer while the graphic is off air',
      clockFieldKeys: keysOfThePitStopCountdown,
      dataOnAir: undefined,
      fieldsTheOperatorChanged: nothingChangedByTheOperator,
      expectedText: undefined,
    },
    // A lower third, or a clock whose manifest lacks a role: a form like any other.
    {
      name: 'gives no text and runs no timer for a graphic that is not a clock',
      clockFieldKeys: undefined,
      dataOnAir: buildStopwatchDataOnAir(true),
      fieldsTheOperatorChanged: nothingChangedByTheOperator,
      expectedText: undefined,
    },
    // Data put on air by another program: no reading, so nothing to work a time out of.
    {
      name: 'gives no text when the data on air is not a clock reading',
      clockFieldKeys: keysOfThePitStopCountdown,
      dataOnAir: { equipe: 'Baja UFPR', tempoMs: '12:34', contando: true },
      fieldsTheOperatorChanged: nothingChangedByTheOperator,
      expectedText: undefined,
    },
    // The operator is typing a correction: the field shows what they type.
    {
      name: 'gives no text and runs no timer once the operator changed the time',
      clockFieldKeys: keysOfThePitStopCountdown,
      dataOnAir: buildStopwatchDataOnAir(true),
      fieldsTheOperatorChanged: { values: { tempoMs: true } },
      expectedText: undefined,
    },
    // A typed moment means the operator is giving the whole reading by hand: the time
    // next to it must be the reading's own, not the time on screen.
    {
      name: 'gives no text once the operator typed the moment the time belongs to',
      clockFieldKeys: keysOfThePitStopCountdown,
      dataOnAir: buildStopwatchDataOnAir(true),
      fieldsTheOperatorChanged: { values: { momentoDaLeituraMs: true } },
      expectedText: undefined,
    },
    // "Momento da entrada no ar" chosen for the moment: an "Atualizar" would start the
    // reference time from the press, so that is the time the operator must see.
    {
      name: 'gives no text once the operator changed who fills that moment',
      clockFieldKeys: keysOfThePitStopCountdown,
      dataOnAir: buildStopwatchDataOnAir(true),
      fieldsTheOperatorChanged: { kinds: { momentoDaLeituraMs: true } },
      expectedText: undefined,
    },
    // Another field changed (the team): the clock's time is still untouched.
    {
      name: 'keeps giving the reading of a held clock when only another field was changed',
      clockFieldKeys: keysOfThePitStopCountdown,
      dataOnAir: buildStopwatchDataOnAir(false),
      fieldsTheOperatorChanged: { values: { equipe: true } },
      expectedText: '12:34',
    },
  ];

  it.each(formsWithoutAMovingText)(
    '$name',
    ({ clockFieldKeys, dataOnAir, fieldsTheOperatorChanged, expectedText }) => {
      // Arrange: 10:00 on the page.
      holdThePageClockAtTenOClock();

      // Act: draw once with what the form knows in this row of the table.
      const { result } = renderHook(() =>
        useTimeOnScreenInQuickEdit({ clockFieldKeys, dataOnAir, fieldsTheOperatorChanged }),
      );

      // Assert: the text of the row (undefined: the field shows what the form holds),
      // and no timer left running on the page.
      expect(
        result.current?.text,
        'the text must be the one of this row, or absent when the form shows its own value',
      ).toBe(expectedText);
      expect(vi.getTimerCount(), 'nothing can change here, so no timer may run').toBe(0);
    },
  );
});
