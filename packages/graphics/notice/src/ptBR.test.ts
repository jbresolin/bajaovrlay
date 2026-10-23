/**
 * pt-BR catalog of the notice (packages/graphics/notice)
 *
 * What this module is for:
 *   Every word the notice puts on air (the badge, the lap caption, the kind words, the
 *   race control caption, the triangle's accessible name) and every message it answers a
 *   renderer with comes from ptBR.ts, so the wording can be reviewed in one place.
 *
 * What these tests prove:
 *   - The fixed on-air words are the design's: MELHOR VOLTA, VOLTA n, DIREÇÃO DE PROVA.
 *   - Each of the four kinds of notice has its on-air word, in capitals.
 *
 * What these tests deliberately do not cover:
 *   - Whether those words actually appear on screen; noticeView.test.ts and the
 *     Playwright screenshots show it.
 */
import { describe, expect, it } from 'vitest';

import { noticeKinds } from './noticeModel.js';
import { ptBR } from './ptBR.js';

describe('the fixed on-air words', () => {
  it('reads as the design writes them', () => {
    // Arrange: nothing to set up; the catalog is a constant.

    // Act: build the words a fastest lap and a penalty show.
    const onAirWords = {
      fastestLapBadge: ptBR.fastestLapBadge,
      lapNumberCaption: ptBR.lapNumberCaption(34),
      raceControlCaption: ptBR.raceControlCaption,
    };

    // Assert: they are the design's words, in capitals.
    expect(onAirWords, 'the on-air words must be the design’s').toEqual({
      fastestLapBadge: 'MELHOR VOLTA',
      lapNumberCaption: 'VOLTA 34',
      raceControlCaption: 'DIREÇÃO DE PROVA',
    });
  });
});

describe('the kind words', () => {
  it('has an on-air word for every kind of notice', () => {
    // Arrange: the four kinds the data schema allows.

    // Act: look up the word for each one.
    const wordsByKind = Object.fromEntries(
      noticeKinds.map((noticeKind) => [noticeKind, ptBR.noticeKindWords[noticeKind]]),
    );

    // Assert: every kind has its word, in capitals as shown on air.
    expect(wordsByKind, 'every kind must have its pt-BR on-air word').toEqual({
      penalty: 'PENALIDADE',
      warning: 'ADVERTÊNCIA',
      incident: 'INCIDENTE',
      notice: 'AVISO',
    });
  });
});
