/**
 * The live answer of the example timing system (scripts)
 *
 * What this module is for:
 *   `pnpm serve:flex-example` serves the fictional example response so the flex source can
 *   be tried for real. The file is a fixed snapshot: its "gerado_em" moment and its
 *   session clock ("restante_s" with "estado": "RUN") describe one instant of March 2027.
 *   Served unchanged, the session card would count down from that far-off moment and show
 *   a nonsense race clock. So at every request the script stamps the answer with the
 *   moment it is made and lowers the time left by the time since the script started, the
 *   way a live timing system's answer changes.
 *
 * What these tests prove:
 *   - "gerado_em" is the moment of the answer, written in Brasília time with its zone.
 *   - "restante_s" goes down by the seconds since the script started, and stops at zero.
 *   - Everything else (the cars, the session's name) is the file's, and the file's own
 *     copy is not changed.
 *
 * What these tests deliberately do not cover:
 *   - The HTTP server around it (the port, the 404 for other paths): it is tried by hand
 *     with `pnpm serve:flex-example`, as the PR walk says.
 *   - That the flex mapping reads the stamped answer: applyFlexMapping.test.ts maps the
 *     same response, and isoDateTextToMs reads any moment with a zone.
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { stampExampleResponseWithTheMomentOfAnswer } from './liveExampleResponse.js';

/** 14:00:00 in Brasília (17:00:00 UTC) on Saturday 18 October 2026, when the script started. */
const scriptStartedAtMs = Date.parse('2026-10-18T17:00:00.000Z');

/** Reads the example response from its file, as the script does at start. */
function readExampleResponse(): {
  gerado_em: string;
  prova: { nome?: string; relogio: { restante_s: number } };
  classificacao: unknown[];
} {
  const responseUrl = new URL(
    '../packages/shared/src/flexMapping/examples/timing-system-like.response.json',
    import.meta.url,
  );
  return JSON.parse(readFileSync(responseUrl, 'utf8'));
}

describe('stampExampleResponseWithTheMomentOfAnswer', () => {
  it('writes the moment of the answer as "gerado_em", in Brasília time with its zone', () => {
    // Arrange: the example, answered 90 seconds after the script started.
    const exampleResponse = readExampleResponse();
    const answeredAtMs = scriptStartedAtMs + 90_000;

    // Act: stamp the answer.
    const answer = stampExampleResponseWithTheMomentOfAnswer(
      exampleResponse,
      scriptStartedAtMs,
      answeredAtMs,
    );

    // Assert: 14:01:30 in Brasília, which is the same instant as 17:01:30 UTC.
    expect(answer.gerado_em, "the moment must be the answer's, with the -03:00 zone").toBe(
      '2026-10-18T14:01:30.000-03:00',
    );
    expect(
      Date.parse(answer.gerado_em),
      'the written moment must be the very instant of the answer',
    ).toBe(answeredAtMs);
  });

  it('lowers the time left by the seconds since the script started', () => {
    // Arrange: the example, whose clock has 4559.052 s left, answered 90.5 s after start.
    const exampleResponse = readExampleResponse();
    const answeredAtMs = scriptStartedAtMs + 90_500;

    // Act: stamp the answer.
    const answer = stampExampleResponseWithTheMomentOfAnswer(
      exampleResponse,
      scriptStartedAtMs,
      answeredAtMs,
    );

    // Assert: 90.5 s less, to the millisecond.
    expect(
      answer.prova.relogio.restante_s,
      'the clock must have run down by the time since start',
    ).toBe(4468.552);
  });

  it('stops the time left at zero once the scheduled time has run out', () => {
    // Arrange: the example, answered two hours after start, past its 1 h 16 min left.
    const exampleResponse = readExampleResponse();
    const answeredAtMs = scriptStartedAtMs + 2 * 60 * 60 * 1_000;

    // Act: stamp the answer.
    const answer = stampExampleResponseWithTheMomentOfAnswer(
      exampleResponse,
      scriptStartedAtMs,
      answeredAtMs,
    );

    // Assert: zero, never a negative time left.
    expect(answer.prova.relogio.restante_s, 'the time left must never go below zero').toBe(0);
  });

  it("keeps the cars and the session's name, and leaves the file's copy unchanged", () => {
    // Arrange: the example, and a copy of it as read.
    const exampleResponse = readExampleResponse();
    const exampleResponseAsRead = structuredClone(exampleResponse);

    // Act: stamp an answer one minute after start.
    const answer = stampExampleResponseWithTheMomentOfAnswer(
      exampleResponse,
      scriptStartedAtMs,
      scriptStartedAtMs + 60_000,
    );

    // Assert: the 20 cars and the session name are the file's, and the example is untouched.
    expect(answer.classificacao, 'the cars must be served as the file has them').toEqual(
      exampleResponseAsRead.classificacao,
    );
    expect(answer.prova.nome, "the session's name must be the file's").toBe(
      exampleResponseAsRead.prova.nome,
    );
    expect(exampleResponse, 'the example read at start must stay as it was').toEqual(
      exampleResponseAsRead,
    );
  });
});
