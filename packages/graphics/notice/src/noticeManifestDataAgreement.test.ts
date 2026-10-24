// @vitest-environment node
/**
 * The manifest's data schema and the graphic's own validation agree
 * (packages/graphics/notice)
 *
 * What this module is for:
 *   notice.ograf.json describes the notice's data as JSON Schema, for renderers and for
 *   the control page's generated form; noticeModel.ts checks the same data with Zod when
 *   `load` and `updateAction` receive it. If the two disagreed, the form could offer a
 *   value the graphic refuses, or refuse one it would take.
 *
 * What these tests prove:
 *   - The same payloads pass or fail both checks: a complete fastest lap and a complete
 *     penalty; the bare minimum; each of the four kinds of notice; an unknown variant, an
 *     unknown kind, an unknown field, a car number of 0, a fractional lap number, a team
 *     name that is not text and a missing car number.
 *
 * What these tests deliberately do not cover:
 *   - The rest of the manifest (settings, titles, durations, the OGraf schema itself);
 *     noticeManifest.test.ts covers it.
 *   - The page: this file runs in plain Node (the pragma on line 1) like its sibling; it
 *     draws nothing.
 */
import { createOGrafSchemaValidator } from '@bajaovrlay/graphics-kit/ografSchemaValidator.testSupport';
import { describe, expect, it } from 'vitest';

import noticeManifest from '../notice.ograf.json';
import { type NoticeData, parseCompleteNoticeData } from './noticeModel.js';

/** Builds the data of a fastest lap: car 31, Acauã Baja (Mauá), 4:38,2 on lap 34. */
function createFastestLapData(): NoticeData {
  return {
    variant: 'fastestLap',
    carNumber: 31,
    teamName: 'Acauã Baja',
    schoolName: 'Mauá',
    lapNumber: 34,
    lapTimeText: '4:38,2',
  };
}

/** Builds the data of a penalty: car 47, Carnaúba Baja (UFERSA), +30 seconds for a jump start. */
function createJumpStartPenaltyData(): NoticeData {
  return {
    variant: 'penalty',
    carNumber: 47,
    teamName: 'Carnaúba Baja',
    schoolName: 'UFERSA',
    noticeKind: 'penalty',
    reason: 'Queima de largada',
    penaltyText: '+30 segundos',
  };
}

const dataAgreementScenarios = [
  // The everyday fastest lap must pass both checks.
  { name: 'both accept a complete fastest lap', data: createFastestLapData(), isValid: true },
  // The everyday penalty must pass both checks.
  { name: 'both accept a complete penalty', data: createJumpStartPenaltyData(), isValid: true },
  // Every optional field really is optional in both.
  {
    name: 'both accept the bare minimum: a variant and a car number',
    data: { variant: 'penalty', carNumber: 47 },
    isValid: true,
  },
  // One row per kind of notice, so a value dropped or misspelled in the manifest's enum
  // (or in Zod) fails here. A warning: race control's advertência.
  {
    name: 'both accept a warning',
    data: { ...createJumpStartPenaltyData(), noticeKind: 'warning' },
    isValid: true,
  },
  // An incident on track, with no penalty decided yet.
  {
    name: 'both accept an incident',
    data: { ...createJumpStartPenaltyData(), noticeKind: 'incident', penaltyText: undefined },
    isValid: true,
  },
  // A plain notice from race control.
  {
    name: 'both accept a plain notice',
    data: { ...createJumpStartPenaltyData(), noticeKind: 'notice' },
    isValid: true,
  },
  // A penalty named as such; listed again here so all four kinds sit together.
  {
    name: 'both accept a penalty',
    data: { ...createJumpStartPenaltyData(), noticeKind: 'penalty' },
    isValid: true,
  },
  // A variant outside the two must fail both, or the form would offer a value the graphic refuses.
  {
    name: 'both refuse an unknown variant',
    data: { ...createFastestLapData(), variant: 'battle' },
    isValid: false,
  },
  // A kind outside the four must fail both.
  {
    name: 'both refuse an unknown kind of notice',
    data: { ...createJumpStartPenaltyData(), noticeKind: 'blackFlag' },
    isValid: false,
  },
  // A typo'd field name must fail both.
  {
    name: 'both refuse an unknown field',
    data: { ...createFastestLapData(), lapTime: '4:38,2' },
    isValid: false,
  },
  // Car numbers start at 1 in both.
  {
    name: 'both refuse car number 0',
    data: { ...createFastestLapData(), carNumber: 0 },
    isValid: false,
  },
  // Lap numbers are whole numbers in both.
  {
    name: 'both refuse a fractional lap number',
    data: { ...createFastestLapData(), lapNumber: 34.5 },
    isValid: false,
  },
  // A team name must be text; a number would be a binding to the wrong field.
  {
    name: 'both refuse a team name that is not text',
    data: { ...createFastestLapData(), teamName: 31 },
    isValid: false,
  },
  // A missing required field fails both.
  {
    name: 'both refuse data without the car number',
    data: { ...createJumpStartPenaltyData(), carNumber: undefined },
    isValid: false,
  },
];

describe('the manifest data schema and the graphic validation agree', () => {
  it.each(dataAgreementScenarios)('$name', ({ data, isValid }) => {
    // Arrange: the manifest's data schema compiled into a validator; JSON drops
    // undefined fields, exactly as they would be dropped on the wire.
    const validator = createOGrafSchemaValidator();
    const validateDataWithManifestSchema = validator.compile(noticeManifest.schema);
    const dataAsSentOnTheWire: unknown = JSON.parse(JSON.stringify(data));

    // Act: check the same payload with both.
    const isValidForManifest = validateDataWithManifestSchema(dataAsSentOnTheWire);
    const isValidForGraphic = parseCompleteNoticeData(dataAsSentOnTheWire).isValid;

    // Assert: both give the expected answer.
    expect(isValidForManifest, 'the manifest data schema must give the expected answer').toBe(
      isValid,
    );
    expect(isValidForGraphic, 'the graphic validation must give the expected answer').toBe(isValid);
  });
});
