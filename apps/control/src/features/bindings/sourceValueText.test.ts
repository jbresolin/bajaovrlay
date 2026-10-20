/**
 * Values read from a source, written for the operator (apps/control)
 *
 * What this module is for:
 *   The item editor's "Valor agora", the bound fields of "Edição rápida" and the
 *   correction dialog all show a value a source sends. Gate 2 of PR #18 found them
 *   showing the raw data ("green", "true", 4559052): one formatter now writes every such
 *   value in pt-BR, keyed on what kind of value it is (the path's value type, and the
 *   clock's own fields by their path or role).
 *
 * What these tests prove:
 *   - Each kind of value is written as the operator reads it: the flag in words, yes/no,
 *     the clock time as mm:ss, the wall-clock moment as a time of day or "—", the clock's
 *     mode in words, numbers in pt-BR digits, a list by its length, text as it is.
 *   - The kind of a binding comes from its path's value type, the clock's time, moment
 *     and mode picked out by path.
 *   - The kind of a field the whole clock fills comes from that field's clock role.
 *
 * What these tests deliberately do not cover:
 *   - Where each text is drawn; the editor, Edição rápida and dialog tests.
 */
import type { BindingFieldValue } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { formatTimeOfDay } from '@/features/dataSources/timeOfDayText';

import {
  findSourceValueKindOfBinding,
  findSourceValueKindOfClockField,
  writeSourceValueForReading,
} from './sourceValueText';

// The moment the simulator's lap-34 clock reading was taken.
const momentOfTheClockReadingMs = 1_805_568_240_948;

describe('writeSourceValueForReading', () => {
  const scenarios = [
    // The flag the simulator sends is a code; the operator reads the flag's name.
    { name: 'writes the yellow flag in words', value: 'yellow', kind: 'flag', text: 'Amarela' },
    // A switch reads as a yes or a no.
    { name: 'writes true as "sim"', value: true, kind: 'yesNo', text: 'sim' },
    { name: 'writes false as "não"', value: false, kind: 'yesNo', text: 'não' },
    // The clock time is milliseconds; the operator reads it as the clock shows it.
    { name: 'writes the clock time as mm:ss', value: 4_559_052, kind: 'clockTime', text: '75:59' },
    // A moment of the wall clock reads as its time of day.
    {
      name: 'writes the wall-clock moment as a time of day',
      value: momentOfTheClockReadingMs,
      kind: 'wallClockMoment',
      text: formatTimeOfDay(momentOfTheClockReadingMs),
    },
    // No moment (a clock never started) reads as a dash, not as 1970.
    { name: 'writes no moment as a dash', value: null, kind: 'wallClockMoment', text: '—' },
    // The clock's mode is a code too.
    {
      name: 'writes the clock mode in words',
      value: 'remaining',
      kind: 'clockMode',
      text: 'Tempo restante',
    },
    // A number in Brazilian digits.
    { name: 'writes points with a decimal comma', value: 646.9, kind: 'number', text: '646,9' },
    // A whole list is too long to read: its length is enough.
    {
      name: 'writes a list by its length',
      value: [{}, {}, {}],
      kind: 'list',
      text: 'lista com 3 entradas',
    },
    // A text is already in words.
    { name: 'writes a text as it is', value: 'Baja UFPR', kind: 'text', text: 'Baja UFPR' },
    // Nothing on air for an optional field.
    { name: 'writes a missing value as a dash', value: undefined, kind: 'text', text: '—' },
  ] as const;

  it.each(scenarios)('$name', ({ value, kind, text }) => {
    // Arrange: this row's value and kind.

    // Act: write it for the operator.
    const written = writeSourceValueForReading(value, kind);

    // Assert: the words the operator reads.
    expect(written, 'the value as the operator reads it').toBe(text);
  });
});

describe('findSourceValueKindOfBinding', () => {
  /** A live binding to the simulator's session at the path given. */
  function bindToTheSession(path: string): BindingFieldValue {
    return {
      kind: 'binding',
      sourceId: 'simulador-enduro',
      shapeKey: 'session',
      path,
      isLive: true,
    };
  }

  const scenarios = [
    // The flag's value type.
    { name: 'reads the flag as a flag', path: 'state', kind: 'flag' },
    // The clock's own fields are integers or texts by type, but each has its own words.
    { name: 'reads the clock time by its path', path: 'clock.referenceTimeMs', kind: 'clockTime' },
    {
      name: 'reads the moment by its path',
      path: 'clock.referenceWallClockMs',
      kind: 'wallClockMoment',
    },
    { name: 'reads the clock mode by its path', path: 'clock.clockMode', kind: 'clockMode' },
    { name: 'reads the running switch as yes/no', path: 'clock.running', kind: 'yesNo' },
    // The whole clock is one reading of all four.
    { name: 'reads the whole clock as a clock reading', path: 'clock', kind: 'clockReading' },
    // A plain text and a plain number.
    { name: 'reads the session name as text', path: 'sessionName', kind: 'text' },
    { name: "reads the leader's laps as a number", path: 'lapsCompletedByLeader', kind: 'number' },
  ];

  it.each(scenarios)('$name', ({ path, kind }) => {
    // Arrange: a binding to this row's path.
    const binding = bindToTheSession(path);

    // Act: find its kind.
    const found = findSourceValueKindOfBinding(binding);

    // Assert: the kind its value is written as.
    expect(found, 'the kind of value at this path').toBe(kind);
  });
});

describe('findSourceValueKindOfClockField', () => {
  it('reads each of the four clock fields by its role', () => {
    // Arrange: the race clock's four clock fields by role.
    const clockFieldKeys = {
      clockTime: 'referenceTimeMs',
      wallClock: 'referenceWallClockMs',
      clockRunning: 'running',
      clockMode: 'clockMode',
    };

    // Act: find the kind of each.
    const kinds = Object.values(clockFieldKeys).map((fieldKey) =>
      findSourceValueKindOfClockField(fieldKey, clockFieldKeys),
    );

    // Assert: time, moment, yes/no and mode.
    expect(kinds, 'each clock field has its own words').toEqual([
      'clockTime',
      'wallClockMoment',
      'yesNo',
      'clockMode',
    ]);
  });
});
