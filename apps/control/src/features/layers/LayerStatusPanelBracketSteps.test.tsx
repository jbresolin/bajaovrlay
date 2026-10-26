/**
 * Layer status panel: the steps of a bracket, counted from its rounds (apps/control)
 *
 * What this module is for:
 *   The bracket's steps depend on its data (BAJAOVRLAY-25): one per round-board page, one
 *   per tree round, one for the third place. Its manifest says `stepCount: -1` and names
 *   the shared step counter, so the Camadas row reads "Passo n de N" from the instance on
 *   air (its rounds), not from the manifest, and "Próximo" switches off on the last of
 *   those steps. A live update that brings more rounds changes N on the row at once.
 *
 * What these tests prove:
 *   - An eight-car bracket at its first step reads "Passo 1 de 3", and "Próximo" is on.
 *   - At its third step it reads "Passo 3 de 3", and "Próximo" is off.
 *   - When the server's next message brings the real Super Prime's rounds (7 steps), the
 *     same row reads "Passo 3 de 7" and "Próximo" is on again.
 *
 * What these tests deliberately do not cover:
 *   - Counting a bracket's steps: packages/shared's bracketSteps.test.ts.
 *   - The server keeping the step within the count: apps/server's
 *     instanceStepsWithinTheirCount.test.ts.
 *   - The podium's fixed steps and a refused "Próximo": LayerStatusPanelNextStep.test.tsx.
 */
import type { Graphic, Instance, Slices } from '@bajaovrlay/shared';
import superPrimeSample from '@bajaovrlay/shared/samples/brackets.super-prime.json';
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import { buildSlicesWithNothingOnAir } from '@/state/slicesLikeTheServerSends.testSupport';

import { LayerStatusPanel } from './LayerStatusPanel';

/** The bracket as the server lists it: its steps counted from its rounds. */
function buildBracketGraphic(): Graphic {
  return {
    id: 'bracket',
    manifest: {
      id: 'baja-bracket',
      name: 'Chaveamento',
      main: 'bracket.js',
      stepCount: -1,
      v_baja: { defaultLayerId: 'fullscreen', stepCounter: 'bracketSteps' },
    },
    defaultLayerId: 'fullscreen',
    category: 'standings',
    thumbnailUrl: null,
    defaultFields: {},
  };
}

/** An eight-car elimination's rounds: quarter-finals, semifinals, final (3 steps). */
function buildEightCarRounds(): unknown[] {
  const buildRound = (name: string, matchCount: number) => ({
    name,
    matches: Array.from({ length: matchCount }, (_unused, index) => ({
      matchId: `${name}-${String(index + 1)}`,
    })),
  });
  return [buildRound('Quartas de final', 4), buildRound('Semifinal', 2), buildRound('Final', 1)];
}

/** The real Super Prime's rounds, from the shared sample (7 steps). */
function readTheRealSuperPrimeRounds(): unknown[] {
  return structuredClone(superPrimeSample.rounds);
}

/** The Super Prime's bracket on air on the fullscreen layer, at a step, with these rounds. */
function buildBracketOnAir(currentStep: number, rounds: unknown[]): Instance {
  return {
    id: 'chaveamento-super-prime',
    layerId: 'fullscreen',
    graphicId: 'bracket',
    target: 'program',
    resolvedData: { title: 'SUPER PRIME', rounds },
    currentStep,
    status: 'on-air',
    takenAt: '2026-10-31T18:40:00.000Z',
  };
}

/** The server's state with the bracket registered and on air as given. */
function buildSlicesWithTheBracket(bracketOnAir: Instance): Slices {
  const slices = buildSlicesWithNothingOnAir();
  return {
    ...slices,
    graphics: [...slices.graphics, buildBracketGraphic()],
    instances: [bracketOnAir],
  };
}

/** The fullscreen row of the panel. */
function findTheFullscreenRow() {
  return within(screen.getByRole('listitem', { name: 'Tela cheia' }));
}

describe('the steps of a bracket on its Camadas row', () => {
  it('reads an eight-car bracket at its first step as step 1 of 3, with "Próximo" on', () => {
    // Arrange: the eight-car bracket at its first step (the quarter-finals).
    const slices = buildSlicesWithTheBracket(buildBracketOnAir(0, buildEightCarRounds()));

    // Act: draw the panel.
    renderOnControlPageConnectedToFakeServer(<LayerStatusPanel />, slices);

    // Assert: three steps, counted from the rounds, and a next one to go to.
    const fullscreenRow = findTheFullscreenRow();
    expect(
      fullscreenRow.getByText('Passo 1 de 3'),
      'three steps from three tree rounds',
    ).toBeVisible();
    expect(
      fullscreenRow.getByRole('button', { name: 'Próximo' }),
      'the semifinals come next',
    ).toBeEnabled();
  });

  it('turns "Próximo" off on the bracket’s last step', () => {
    // Arrange: the eight-car bracket at its third step (the final).
    const slices = buildSlicesWithTheBracket(buildBracketOnAir(2, buildEightCarRounds()));

    // Act: draw the panel.
    renderOnControlPageConnectedToFakeServer(<LayerStatusPanel />, slices);

    // Assert: step 3 of 3, and nothing after it.
    const fullscreenRow = findTheFullscreenRow();
    expect(fullscreenRow.getByText('Passo 3 de 3'), 'the final is the last step').toBeVisible();
    expect(
      fullscreenRow.getByRole('button', { name: 'Próximo' }),
      'nothing comes after the final',
    ).toBeDisabled();
  });

  it('counts again when a live update brings more rounds', () => {
    // Arrange: the eight-car bracket at its last step, on the page.
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(
      <LayerStatusPanel />,
      buildSlicesWithTheBracket(buildBracketOnAir(2, buildEightCarRounds())),
    );

    // Act: the server's next message: the same instance, now with the real Super Prime's rounds.
    fakeServer.sendMessage({
      type: 'slices',
      slices: { instances: [buildBracketOnAir(2, readTheRealSuperPrimeRounds())] },
      serverNowMs: Date.parse('2026-10-31T18:41:00.000Z'),
    });

    // Assert: the same step, now of seven, and "Próximo" on again.
    const fullscreenRow = findTheFullscreenRow();
    expect(
      fullscreenRow.getByText('Passo 3 de 7'),
      'seven steps from the new rounds',
    ).toBeVisible();
    expect(
      fullscreenRow.getByRole('button', { name: 'Próximo' }),
      'the quarter-finals come next',
    ).toBeEnabled();
  });
});
