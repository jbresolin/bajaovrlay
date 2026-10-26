/**
 * A graphic's current step stays within its steps (apps/server)
 *
 * What this module is for:
 *   The bracket's steps are counted from its rounds (BAJAOVRLAY-25: the manifest's
 *   `stepCount: -1` and `v_baja.stepCounter`), so data arriving on air can change how many
 *   steps it has. A live refresh that leaves the bracket with fewer steps than the one on
 *   screen would leave Camadas reading "Passo 6 de 3" and the renderer on a step the graphic
 *   no longer has. reduceCommand therefore puts every instance whose step is past its count
 *   on its last step, in the same change, and the renderer plays that step.
 *
 * What these tests prove:
 *   - A refresh, or an operator's update, that shrinks the real Super Prime (7 steps) to an
 *     eight-car bracket (3) while it is on its 6th step puts it on its last, the 3rd,
 *     keeping its id and data, and the outcome names the move for the store's log line.
 *   - A refresh that keeps the step within the count leaves the step alone, and so does
 *     one that adds steps.
 *   - "Próximo" on the bracket's last counted step is refused with NO_NEXT_STEP, as on the
 *     podium's last; one pressed from the step the bracket had before a clamp is refused
 *     with STEP_ALREADY_MOVED.
 *
 * What these tests deliberately do not cover:
 *   - How the steps are counted: packages/shared/src/steps (bracketSteps, graphicSteps).
 *   - The log line and the clamp at boot: ../storeStepsBroughtBack.test.ts.
 *   - The renderer playing the lower step: its reconciler tests.
 */
import { readFileSync } from 'node:fs';

import type { Graphic, Instance } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import {
  buildRaceDaySlicesWithInstances,
  contextOfTheCommand,
} from './raceDaySlices.testSupport.js';
import { reduceCommand } from './reduceCommand.js';
import type { SlicesChangedByCommands } from './reducerTypes.js';

const bracketOnAirId = 'chaveamento-no-ar';

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
      schema: {
        type: 'object',
        properties: { title: { type: 'string' }, rounds: { type: 'array' } },
        required: ['rounds'],
      },
    },
    defaultLayerId: 'fullscreen',
    category: 'standings',
    thumbnailUrl: null,
    defaultFields: {},
  };
}

/** The real Super Prime's rounds, from the shared sample: 7 steps. */
function readTheRealSuperPrimeRounds(): unknown[] {
  const sampleUrl = new URL(
    '../../../../../../packages/shared/src/dataShapes/samples/brackets.super-prime.json',
    import.meta.url,
  );
  return (JSON.parse(readFileSync(sampleUrl, 'utf8')) as { rounds: unknown[] }).rounds;
}

/** An eight-car elimination's rounds with no results yet: 3 steps. */
function buildEightCarRounds(): unknown[] {
  const buildRound = (name: string, matchCount: number) => ({
    name,
    matches: Array.from({ length: matchCount }, (_unused, index) => ({
      matchId: `${name}-${String(index + 1)}`,
      carA: { carNumber: 10 + index * 2, teamName: 'Komiketo', schoolName: 'UFSJ' },
      carB: { carNumber: 11 + index * 2, teamName: 'Bombaja', schoolName: 'UFSM' },
    })),
  });
  return [buildRound('Quartas de final', 4), buildRound('Semifinal', 2), buildRound('Final', 1)];
}

/** The bracket on air on the fullscreen layer, at a step, showing these rounds. */
function buildBracketOnAirAtStep(currentStep: number, rounds: unknown[]): Instance {
  return {
    id: bracketOnAirId,
    layerId: 'fullscreen',
    graphicId: 'bracket',
    target: 'program',
    resolvedData: { title: 'SUPER PRIME', rounds },
    currentStep,
    status: 'on-air',
    takenAt: '2026-10-31T18:40:00.000Z',
  };
}

/** A race day with the bracket registered and on air as given. */
function buildRaceDayWithTheBracket(bracketOnAir: Instance): SlicesChangedByCommands {
  const slices = buildRaceDaySlicesWithInstances([bracketOnAir]);
  return { ...slices, graphics: [...slices.graphics, buildBracketGraphic()] };
}

/** The bracket after an outcome, when it was applied. */
function readBracketAfter(outcome: ReturnType<typeof reduceCommand>): Instance | undefined {
  return outcome.status === 'applied'
    ? outcome.slices.instances.find((instance) => instance.id === bracketOnAirId)
    : undefined;
}

describe('an update that changes how many steps the bracket has', () => {
  const shrinkingUpdateScenarios = [
    // The source's next poll: the refresher's command (BAJAOVRLAY-20).
    {
      name: 'a live refresh',
      command: {
        type: 'refreshBoundInstanceData' as const,
        instanceId: bracketOnAirId,
        data: { rounds: buildEightCarRounds() },
      },
    },
    // An operator's "Edição rápida" sending new rounds by hand.
    {
      name: 'an operator’s update',
      command: {
        type: 'updateInstanceData' as const,
        instanceId: bracketOnAirId,
        data: { rounds: buildEightCarRounds() },
        takeTimeFieldKeys: [],
      },
    },
  ];

  it.each(shrinkingUpdateScenarios)(
    'puts the bracket on its last step when $name leaves it fewer steps than the one on screen, and says so',
    ({ command }) => {
      // Arrange: the real Super Prime on air at its 6th step (the third place), index 5.
      const slicesBefore = buildRaceDayWithTheBracket(
        buildBracketOnAirAtStep(5, readTheRealSuperPrimeRounds()),
      );

      // Act: the row's command brings an eight-car bracket (3 steps) instead.
      const outcome = reduceCommand(slicesBefore, command, contextOfTheCommand);
      const bracketAfter = readBracketAfter(outcome);

      // Assert: applied, the new rounds on air, the step brought back to the last (index
      // 2), the same instance, and the outcome naming the move for the store's log line.
      expect(outcome.status, 'the update must be applied').toBe('applied');
      expect(bracketAfter?.resolvedData.rounds, 'the new rounds are on air').toEqual(
        buildEightCarRounds(),
      );
      expect(bracketAfter?.currentStep, 'the step must be the last one the rounds have').toBe(2);
      expect(bracketAfter?.id, 'it is the same instance, updated in place').toBe(bracketOnAirId);
      expect(
        outcome.status === 'applied' ? outcome.stepsBroughtBack : undefined,
        'the outcome says which step moved, from what to what',
      ).toEqual([{ instanceId: bracketOnAirId, stepBefore: 5, stepAfter: 2 }]);
    },
  );

  const stepKeptScenarios = [
    // Fewer steps, but still more than the one on screen: nothing to bring back.
    {
      name: 'leaves the step alone when it is still within the new count',
      stepBefore: 1,
      roundsBefore: readTheRealSuperPrimeRounds(),
      roundsAfter: buildEightCarRounds(),
    },
    // More steps (a source listing the next round): the step on screen is still there.
    {
      name: 'leaves the step alone when the new rounds add steps',
      stepBefore: 2,
      roundsBefore: buildEightCarRounds(),
      roundsAfter: readTheRealSuperPrimeRounds(),
    },
  ];

  it.each(stepKeptScenarios)('$name', ({ stepBefore, roundsBefore, roundsAfter }) => {
    // Arrange: the bracket on air at the row's step with the row's rounds.
    const slicesBefore = buildRaceDayWithTheBracket(
      buildBracketOnAirAtStep(stepBefore, roundsBefore),
    );

    // Act: a refresh with the row's new rounds.
    const outcome = reduceCommand(
      slicesBefore,
      {
        type: 'refreshBoundInstanceData',
        instanceId: bracketOnAirId,
        data: { rounds: roundsAfter },
      },
      contextOfTheCommand,
    );

    // Assert: the step is the one it was.
    expect(readBracketAfter(outcome)?.currentStep, 'the step must not move').toBe(stepBefore);
  });
});

describe('"Próximo" on the bracket', () => {
  it('is refused with STEP_ALREADY_MOVED when pressed from the step the bracket had before a clamp', () => {
    // Arrange: the real Super Prime on air at index 5, then a refresh shrinks it to three
    // steps, which brings it back to index 2; the operator's page still showed index 5.
    const slicesOnAir = buildRaceDayWithTheBracket(
      buildBracketOnAirAtStep(5, readTheRealSuperPrimeRounds()),
    );
    const refresh = reduceCommand(
      slicesOnAir,
      {
        type: 'refreshBoundInstanceData',
        instanceId: bracketOnAirId,
        data: { rounds: buildEightCarRounds() },
      },
      contextOfTheCommand,
    );
    const slicesAfterTheClamp = refresh.status === 'applied' ? refresh.slices : slicesOnAir;

    // Act: "Próximo" pressed from the step the page showed before the clamp.
    const outcome = reduceCommand(
      slicesAfterTheClamp,
      { type: 'nextOnLayer', layerId: 'fullscreen', fromStep: 5 },
      contextOfTheCommand,
    );

    // Assert: refused, so a press made on the old count reveals nothing.
    expect(
      outcome.status === 'refused' ? outcome.error.code : outcome.status,
      'a press from a step the bracket has left is refused',
    ).toBe('STEP_ALREADY_MOVED');
  });

  it('is refused with NO_NEXT_STEP on the last step its rounds give', () => {
    // Arrange: an eight-car bracket on air at its 3rd and last step (the final).
    const slicesBefore = buildRaceDayWithTheBracket(
      buildBracketOnAirAtStep(2, buildEightCarRounds()),
    );

    // Act: the operator presses "Próximo" from that step.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'nextOnLayer', layerId: 'fullscreen', fromStep: 2 },
      contextOfTheCommand,
    );

    // Assert: refused; leaving the air is "Limpar".
    expect(outcome.status, 'there is no step after the final').toBe('refused');
    expect(
      outcome.status === 'refused' ? outcome.error.code : undefined,
      'the refusal says there is no next step',
    ).toBe('NO_NEXT_STEP');
  });
});
