/**
 * The notice's DOM writer (packages/graphics/notice)
 *
 * What this module is for:
 *   noticeView.ts draws the notice's markup once, with the parts of both variants, and
 *   afterwards writes the data into it in place: the parts a variant or the data has no
 *   use for are hidden, never removed. An event often knows only some fields, so a
 *   notice with fields missing must still be a clean card, with no empty box on air.
 *
 * What these tests prove:
 *   - A fastest lap shows the green MELHOR VOLTA badge, VOLTA n, the chip, the team and
 *     school and the lap time, and no warning, reason or penalty.
 *   - A penalty shows the warning triangle, the kind word, DIREÇÃO DE PROVA, the chip,
 *     the team and school, the reason and the penalty cell, and no badge or lap time.
 *   - Each missing optional field leaves its own part out: the school, the lap number,
 *     the lap time, the penalty, the reason (and the whole reason row when both are
 *     missing), the team (the chip alone); a text of blanks counts as missing.
 *   - Each of the four kinds writes its pt-BR word, and a missing kind writes PENALIDADE.
 *   - Switching the variant redraws the same elements, nothing rebuilt.
 *
 * What these tests deliberately do not cover:
 *   - How the card looks; jsdom draws nothing. e2e/noticeScreenshots.e2e.ts pins both
 *     variants against their baselines, and e2e/noticeOptionalFields.e2e.ts a card with
 *     its optional fields left out.
 */
import { render } from 'lit';
import { describe, expect, it } from 'vitest';

import type { NoticeData } from './noticeModel.js';
import {
  findNoticeParts,
  type NoticeParts,
  renderNoticeTemplate,
  writeNoticeData,
} from './noticeView.js';

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

/** Draws the notice's markup into a fresh container and returns its parts. */
function drawNoticeParts(): NoticeParts {
  const container = document.createElement('div');
  render(renderNoticeTemplate(), container);
  return findNoticeParts(container);
}

/**
 * Describes what a reader sees: the text of every part that is shown, by part name, and
 * nothing for a hidden part (or one inside a hidden row or block).
 */
function describeShownParts(parts: NoticeParts): Record<string, string> {
  const shownTextByPart: Record<string, string> = {};
  const partsToRead: Array<[string, HTMLElement, HTMLElement[]]> = [
    ['bestLapBadge', parts.bestLapBadge, []],
    ['kindWord', parts.kindWord, [parts.warningBadge]],
    ['headCaption', parts.headCaption, []],
    ['carNumber', parts.carNumber, []],
    ['teamName', parts.teamName, [parts.team]],
    ['schoolName', parts.schoolName, [parts.team]],
    ['lapTime', parts.lapTime, []],
    ['reason', parts.reason, [parts.reasonRow]],
    ['penalty', parts.penalty, [parts.reasonRow]],
  ];
  for (const [partName, part, containers] of partsToRead) {
    const isInsideAHiddenContainer = containers.some((container) => container.hidden);
    if (!part.hidden && !isInsideAHiddenContainer) {
      shownTextByPart[partName] = part.textContent ?? '';
    }
  }
  return shownTextByPart;
}

describe('a fastest lap', () => {
  it('shows the badge, the lap, the car, the team with its school and the time, and nothing of a penalty', () => {
    // Arrange: freshly drawn parts and the fastest lap of car 31.
    const parts = drawNoticeParts();

    // Act: write the fastest lap into them.
    writeNoticeData(parts, createFastestLapData());

    // Assert: exactly the fastest lap's parts are shown, with their text.
    expect(describeShownParts(parts), 'a fastest lap must show its own parts only').toEqual({
      bestLapBadge: 'MELHOR VOLTA',
      headCaption: 'VOLTA 34',
      carNumber: '31',
      teamName: 'Acauã Baja',
      schoolName: 'Mauá',
      lapTime: '4:38,2',
    });
    expect(parts.panel.dataset.variant, 'the card must carry its variant for the styles').toBe(
      'fastestLap',
    );
  });
});

describe('a penalty', () => {
  it('shows the warning, the kind, race control, the car, the team, the reason and the penalty', () => {
    // Arrange: freshly drawn parts and the jump-start penalty of car 47.
    const parts = drawNoticeParts();

    // Act: write the penalty into them.
    writeNoticeData(parts, createJumpStartPenaltyData());

    // Assert: exactly the penalty's parts are shown, the warning triangle among them.
    expect(describeShownParts(parts), 'a penalty must show its own parts only').toEqual({
      kindWord: 'PENALIDADE',
      headCaption: 'DIREÇÃO DE PROVA',
      carNumber: '47',
      teamName: 'Carnaúba Baja',
      schoolName: 'UFERSA',
      reason: 'Queima de largada',
      penalty: '+30 segundos',
    });
    expect(parts.warningBadge.hidden, 'the warning triangle and word must be shown').toBe(false);
  });
});

describe('optional fields left out', () => {
  const missingFieldScenarios = [
    {
      // A school the event does not know: the team name stands alone.
      name: 'a fastest lap without a school shows no school',
      data: { ...createFastestLapData(), schoolName: undefined },
      expected: {
        bestLapBadge: 'MELHOR VOLTA',
        headCaption: 'VOLTA 34',
        carNumber: '31',
        teamName: 'Acauã Baja',
        lapTime: '4:38,2',
      },
    },
    {
      // The positions carry no lap number for a best lap yet: the head has the badge only.
      name: 'a fastest lap without a lap number shows no VOLTA caption',
      data: { ...createFastestLapData(), lapNumber: undefined },
      expected: {
        bestLapBadge: 'MELHOR VOLTA',
        carNumber: '31',
        teamName: 'Acauã Baja',
        schoolName: 'Mauá',
        lapTime: '4:38,2',
      },
    },
    {
      // A fastest lap taken by hand before the time is typed.
      name: 'a fastest lap without a time shows no time',
      data: { ...createFastestLapData(), lapTimeText: undefined },
      expected: {
        bestLapBadge: 'MELHOR VOLTA',
        headCaption: 'VOLTA 34',
        carNumber: '31',
        teamName: 'Acauã Baja',
        schoolName: 'Mauá',
      },
    },
    {
      // A car the positions do not name: the chip alone, school included, since a school
      // beside the chip would read as the team.
      name: 'a notice without a team name shows the chip alone',
      data: { ...createJumpStartPenaltyData(), teamName: undefined },
      expected: {
        kindWord: 'PENALIDADE',
        headCaption: 'DIREÇÃO DE PROVA',
        carNumber: '47',
        reason: 'Queima de largada',
        penalty: '+30 segundos',
      },
    },
    {
      // An incident with no penalty decided yet: the reason without the navy cell.
      name: 'a penalty without a penalty text shows no navy cell',
      data: { ...createJumpStartPenaltyData(), penaltyText: undefined },
      expected: {
        kindWord: 'PENALIDADE',
        headCaption: 'DIREÇÃO DE PROVA',
        carNumber: '47',
        teamName: 'Carnaúba Baja',
        schoolName: 'UFERSA',
        reason: 'Queima de largada',
      },
    },
    {
      // A penalty decided with no reason given: the cell still shows, alone in its row.
      name: 'a penalty without a reason shows the penalty cell alone',
      data: { ...createJumpStartPenaltyData(), reason: undefined },
      expected: {
        kindWord: 'PENALIDADE',
        headCaption: 'DIREÇÃO DE PROVA',
        carNumber: '47',
        teamName: 'Carnaúba Baja',
        schoolName: 'UFERSA',
        penalty: '+30 segundos',
      },
    },
    {
      // Neither a reason nor a penalty: no reason row at all, the card is head and car.
      name: 'a penalty without a reason or a penalty text shows no reason row',
      data: { ...createJumpStartPenaltyData(), reason: undefined, penaltyText: undefined },
      expected: {
        kindWord: 'PENALIDADE',
        headCaption: 'DIREÇÃO DE PROVA',
        carNumber: '47',
        teamName: 'Carnaúba Baja',
        schoolName: 'UFERSA',
      },
    },
    {
      // A field cleared by typing spaces, or an event that sent an empty name.
      name: 'a text of blanks counts as missing',
      data: { ...createFastestLapData(), schoolName: '  ', lapTimeText: '' },
      expected: {
        bestLapBadge: 'MELHOR VOLTA',
        headCaption: 'VOLTA 34',
        carNumber: '31',
        teamName: 'Acauã Baja',
      },
    },
  ];

  it.each(missingFieldScenarios)('$name', ({ data, expected }) => {
    // Arrange: freshly drawn parts; the data comes from the scenario row above.
    const parts = drawNoticeParts();

    // Act: write the data into them.
    writeNoticeData(parts, data);

    // Assert: the part of the missing field is left out and everything else is shown.
    expect(describeShownParts(parts), 'a missing field must leave out its part only').toEqual(
      expected,
    );
  });

  it('shows no reason row when the penalty has neither a reason nor a penalty text', () => {
    // Arrange: freshly drawn parts, and a penalty with no reason and no penalty.
    const parts = drawNoticeParts();
    const bareIncident = {
      ...createJumpStartPenaltyData(),
      reason: undefined,
      penaltyText: undefined,
    };

    // Act: write it.
    writeNoticeData(parts, bareIncident);

    // Assert: the row itself is hidden, so the card is no taller than head and car row.
    expect(parts.reasonRow.hidden, 'with nothing to show, the reason row must be hidden').toBe(
      true,
    );
  });
});

describe('the kind word in a penalty notice’s head', () => {
  const kindWordScenarios = [
    // The everyday notice: a time penalty.
    { name: 'reads PENALIDADE for a penalty', noticeKind: 'penalty', expected: 'PENALIDADE' },
    // Race control's warning before a penalty.
    { name: 'reads ADVERTÊNCIA for a warning', noticeKind: 'warning', expected: 'ADVERTÊNCIA' },
    // An incident on track under investigation.
    { name: 'reads INCIDENTE for an incident', noticeKind: 'incident', expected: 'INCIDENTE' },
    // Any other word from race control.
    { name: 'reads AVISO for a plain notice', noticeKind: 'notice', expected: 'AVISO' },
    // No kind sent: the most common one.
    {
      name: 'reads PENALIDADE when no kind is given',
      noticeKind: undefined,
      expected: 'PENALIDADE',
    },
  ] as const;

  it.each(kindWordScenarios)('$name', ({ noticeKind, expected }) => {
    // Arrange: freshly drawn parts and the penalty with the scenario's kind.
    const parts = drawNoticeParts();

    // Act: write it.
    writeNoticeData(parts, { ...createJumpStartPenaltyData(), noticeKind });

    // Assert: the head reads the kind's pt-BR word.
    expect(parts.kindWord.textContent, 'the head must read the kind’s pt-BR word').toBe(expected);
  });
});

describe('switching the variant', () => {
  it('redraws a fastest lap as a penalty on the same elements', () => {
    // Arrange: parts showing the fastest lap, with the card and the car chip noted.
    const parts = drawNoticeParts();
    writeNoticeData(parts, createFastestLapData());
    const panelBefore = parts.panel;
    const chipBefore = parts.carNumber;

    // Act: write the penalty over it.
    writeNoticeData(parts, createJumpStartPenaltyData());

    // Assert: the same elements now show the penalty, and the lap time is gone.
    expect(parts.panel, 'the card must be the same element, never rebuilt').toBe(panelBefore);
    expect(parts.carNumber, 'the chip must be the same element, never rebuilt').toBe(chipBefore);
    expect(parts.carNumber.textContent, 'the chip must read the new car').toBe('47');
    expect(parts.lapTime.hidden, 'a penalty must not keep the fastest lap’s time').toBe(true);
    expect(parts.bestLapBadge.hidden, 'a penalty must not keep the green badge').toBe(true);
  });
});
