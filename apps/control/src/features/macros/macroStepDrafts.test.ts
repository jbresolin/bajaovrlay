/**
 * The macro editor's steps, from what the operator typed to what the server stores
 * (apps/control)
 *
 * What this module is for:
 *   The macro editor shows a list of step rows: a kind ("Pôr item no ar", "Limpar
 *   camada", "Limpar tudo", "Trocar cena do OBS", "Esperar") and, depending on the kind,
 *   an item, a layer, one of OBS's scenes or a wait typed in seconds. macroStepDrafts.ts turns those rows into the exact `steps`
 *   array of createMacro and updateMacro, with one pt-BR message per wrong row, and turns
 *   a stored macro's steps back into rows. Pure functions; no drawing.
 *
 * What these tests prove:
 *   - Each kind of row becomes exactly its step, in the order of the rows, and a row
 *     keeps only what its kind needs (an item chosen before the kind was changed to
 *     "Limpar tudo" is not sent).
 *   - A wait is typed in seconds, with a comma or a point and up to three decimals, and is
 *     sent in whole milliseconds; outside 1 ms to 10 s, or not a number, it is refused
 *     with a pt-BR message, and so is a row with no item or no layer chosen.
 *   - A "Trocar cena do OBS" row becomes obsScene with its scene and Program or Preview;
 *     it is refused only with no scene. A scene OBS does not list now (renamed, or OBS
 *     not connected) still saves, and the row is flagged for a warning instead: OBS may
 *     have it again when the macro runs, and the run stops at that step if it does not.
 *   - A stored macro's steps come back as rows that build the very same steps.
 *   - The wait shows in seconds the way an operator writes it ("0,5", not "0.500").
 *
 * What these tests deliberately do not cover:
 *   - Whether the item or layer a step names exists: the server refuses such a step when
 *     the macro runs, not when it is saved.
 *   - The editor on screen: MacroEditorPanel.test.tsx.
 */
import type { MacroStep } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import {
  buildMacroStepDraftsFromSteps,
  buildMacroStepsFromDrafts,
  formatWaitMillisecondsAsSecondsText,
  isTheSceneOfTheRowMissingFromObsNow,
  type MacroStepDraft,
} from './macroStepDrafts';

/** The scenes OBS lists on the stream PC, as the obs slice holds them. */
const scenesOfTheStreamPcObs = ['Pista', 'Box', 'Pódio', 'Intervalo'];

/** A row as the editor holds it; every field present, as a new row has them. */
function buildDraft(parts: Partial<MacroStepDraft> & Pick<MacroStepDraft, 'draftId' | 'kind'>) {
  return {
    itemId: '',
    layerId: '',
    waitSecondsText: '',
    sceneName: '',
    obsTarget: 'program' as const,
    triggerKeyByFieldKey: {},
    ...parts,
  };
}

describe('buildMacroStepsFromDrafts', () => {
  it('builds the steps of "Abrir a sessão": clock on, wait half a second, bug on', () => {
    // Arrange: three rows as the operator left them.
    const drafts = [
      buildDraft({ draftId: 'passo-1', kind: 'takeItem', itemId: 'item-relogio-enduro' }),
      buildDraft({ draftId: 'passo-2', kind: 'wait', waitSecondsText: '0,5' }),
      buildDraft({ draftId: 'passo-3', kind: 'takeItem', itemId: 'item-logo-baja' }),
    ];

    // Act: build the steps.
    const result = buildMacroStepsFromDrafts(drafts);

    // Assert: the exact array the server stores, in the rows' order.
    expect(result, 'the three rows must become exactly these three steps').toEqual({
      isValid: true,
      steps: [
        { kind: 'takeItem', itemId: 'item-relogio-enduro' },
        { kind: 'wait', ms: 500 },
        { kind: 'takeItem', itemId: 'item-logo-baja' },
      ],
    });
  });

  const oneRowScenarios = [
    // A layer row sends its layer and nothing else.
    {
      name: 'a "Limpar camada" row becomes clearLayer with its layer',
      draft: buildDraft({ draftId: 'passo-1', kind: 'clearLayer', layerId: 'lower-third' }),
      expectedStep: { kind: 'clearLayer', layerId: 'lower-third' },
    },
    // An item picked before the kind was switched must not leak into the step.
    {
      name: 'a "Limpar tudo" row sends nothing but its kind, whatever was picked before',
      draft: buildDraft({ draftId: 'passo-1', kind: 'clearAll', itemId: 'item-logo-baja' }),
      expectedStep: { kind: 'clearAll' },
    },
    // Whole seconds need no decimal part.
    {
      name: 'a wait of "2" seconds is 2000 ms',
      draft: buildDraft({ draftId: 'passo-1', kind: 'wait', waitSecondsText: '2' }),
      expectedStep: { kind: 'wait', ms: 2000 },
    },
    // A point works as well as a comma, for a keyboard set to English.
    {
      name: 'a wait of "1.25" seconds is 1250 ms',
      draft: buildDraft({ draftId: 'passo-1', kind: 'wait', waitSecondsText: '1.25' }),
      expectedStep: { kind: 'wait', ms: 1250 },
    },
    // The smallest wait the server accepts.
    {
      name: 'a wait of "0,001" seconds is 1 ms',
      draft: buildDraft({ draftId: 'passo-1', kind: 'wait', waitSecondsText: '0,001' }),
      expectedStep: { kind: 'wait', ms: 1 },
    },
    // "Pista + torre": the scene first; Program unless Preview was chosen.
    {
      name: 'a "Trocar cena do OBS" row becomes obsScene with its scene, on Program',
      draft: buildDraft({ draftId: 'passo-1', kind: 'obsScene', sceneName: 'Pista' }),
      expectedStep: { kind: 'obsScene', sceneName: 'Pista', target: 'program' },
    },
    // Studio Mode: the scene lined up on OBS's Preview.
    {
      name: 'a "Trocar cena do OBS" row on Preview keeps Preview',
      draft: buildDraft({
        draftId: 'passo-1',
        kind: 'obsScene',
        sceneName: 'Pódio',
        obsTarget: 'preview',
      }),
      expectedStep: { kind: 'obsScene', sceneName: 'Pódio', target: 'preview' },
    },
    // The longest wait the server accepts, typed with spaces around it.
    {
      name: 'a wait of " 10 " seconds is 10 000 ms',
      draft: buildDraft({ draftId: 'passo-1', kind: 'wait', waitSecondsText: ' 10 ' }),
      expectedStep: { kind: 'wait', ms: 10_000 },
    },
  ];

  it.each(oneRowScenarios)('$name', ({ draft, expectedStep }) => {
    // Arrange: the one row, from the table.

    // Act: build the steps.
    const result = buildMacroStepsFromDrafts([draft]);

    // Assert: the one expected step.
    expect(result, 'the row must become exactly this step').toEqual({
      isValid: true,
      steps: [expectedStep],
    });
  });

  const wrongRowScenarios = [
    // A take with no item has nothing to take.
    {
      name: 'refuses a "Pôr item no ar" row with no item',
      draft: buildDraft({ draftId: 'passo-1', kind: 'takeItem' }),
      expectedMessage: 'Escolha o item deste passo.',
    },
    // A clear with no layer has nothing to clear.
    {
      name: 'refuses a "Limpar camada" row with no layer',
      draft: buildDraft({ draftId: 'passo-1', kind: 'clearLayer' }),
      expectedMessage: 'Escolha a camada deste passo.',
    },
    // Blank is not "no wait": a wait row must say how long.
    {
      name: 'refuses a blank wait',
      draft: buildDraft({ draftId: 'passo-1', kind: 'wait', waitSecondsText: '' }),
      expectedMessage: 'Informe a espera em segundos, de 0,001 a 10 (por exemplo 0,5).',
    },
    // Past the server's ten seconds.
    {
      name: 'refuses a wait longer than ten seconds',
      draft: buildDraft({ draftId: 'passo-1', kind: 'wait', waitSecondsText: '10,5' }),
      expectedMessage: 'Informe a espera em segundos, de 0,001 a 10 (por exemplo 0,5).',
    },
    // Zero would be a step that does nothing; the server refuses it.
    {
      name: 'refuses a wait of zero',
      draft: buildDraft({ draftId: 'passo-1', kind: 'wait', waitSecondsText: '0' }),
      expectedMessage: 'Informe a espera em segundos, de 0,001 a 10 (por exemplo 0,5).',
    },
    // A part of a millisecond cannot be sent; refused rather than rounded silently.
    {
      name: 'refuses a wait with four decimals',
      draft: buildDraft({ draftId: 'passo-1', kind: 'wait', waitSecondsText: '0,0005' }),
      expectedMessage: 'Informe a espera em segundos, de 0,001 a 10 (por exemplo 0,5).',
    },
    // Not a number at all.
    {
      name: 'refuses a wait written in words',
      draft: buildDraft({ draftId: 'passo-1', kind: 'wait', waitSecondsText: 'meio segundo' }),
      expectedMessage: 'Informe a espera em segundos, de 0,001 a 10 (por exemplo 0,5).',
    },
    // A scene row with nothing picked would switch to nothing.
    {
      name: 'refuses a "Trocar cena do OBS" row with no scene',
      draft: buildDraft({ draftId: 'passo-1', kind: 'obsScene' }),
      expectedMessage: 'Escolha a cena do OBS deste passo.',
    },
  ];

  it.each(wrongRowScenarios)('$name', ({ draft, expectedMessage }) => {
    // Arrange: a good first row and the wrong row from the table after it.
    const drafts = [buildDraft({ draftId: 'passo-0', kind: 'clearAll' }), draft];

    // Act: build the steps.
    const result = buildMacroStepsFromDrafts(drafts);

    // Assert: refused, with the message on the wrong row only.
    expect(result, 'a wrong row must refuse the whole list, naming only that row').toEqual({
      isValid: false,
      errorMessageByDraftId: { 'passo-1': expectedMessage },
    });
  });

  it('accepts an empty list, since a macro being written may have no step yet', () => {
    // Arrange: no rows.

    // Act: build the steps.
    const result = buildMacroStepsFromDrafts([]);

    // Assert: a valid empty list.
    expect(result, 'no rows must be a valid empty list of steps').toEqual({
      isValid: true,
      steps: [],
    });
  });
});

describe('scene rows OBS does not list now', () => {
  it('saves a scene row whatever OBS lists, since OBS is only asked when the macro runs', () => {
    // Arrange: a scene row picked while OBS was connected, then OBS closed.
    const drafts = [
      buildDraft({ draftId: 'passo-1', kind: 'obsScene', sceneName: 'Pista' }),
      buildDraft({ draftId: 'passo-2', kind: 'clearAll' }),
    ];

    // Act: build the steps (OBS's list is not an input any more).
    const result = buildMacroStepsFromDrafts(drafts);

    // Assert: both steps saved as they are.
    expect(result, 'a scene step saves without OBS').toEqual({
      isValid: true,
      steps: [{ kind: 'obsScene', sceneName: 'Pista', target: 'program' }, { kind: 'clearAll' }],
    });
  });

  const warningScenarios = [
    // The usual case: OBS has the scene, nothing to warn about.
    {
      name: 'no warning for a scene OBS lists',
      draft: buildDraft({ draftId: 'passo-1', kind: 'obsScene', sceneName: 'Pista' }),
      obsSceneNames: scenesOfTheStreamPcObs,
      isWarned: false,
    },
    // Renamed in OBS since the macro was saved: the run would stop at this step.
    {
      name: 'a warning for a scene OBS no longer lists',
      draft: buildDraft({ draftId: 'passo-1', kind: 'obsScene', sceneName: 'Pódio 2025' }),
      obsSceneNames: scenesOfTheStreamPcObs,
      isWarned: true,
    },
    // OBS closed: no list to find the scene in, so the operator is told it was not found.
    {
      name: 'a warning for any scene while OBS is not connected',
      draft: buildDraft({ draftId: 'passo-1', kind: 'obsScene', sceneName: 'Pista' }),
      obsSceneNames: [],
      isWarned: true,
    },
    // Nothing picked yet: the save's own message ("Escolha a cena…") says what to do.
    {
      name: 'no warning for a scene row with no scene picked',
      draft: buildDraft({ draftId: 'passo-1', kind: 'obsScene' }),
      obsSceneNames: [],
      isWarned: false,
    },
    // A row switched away from "Trocar cena do OBS" keeps its scene but sends none.
    {
      name: 'no warning for a row of another kind that still holds a scene',
      draft: buildDraft({ draftId: 'passo-1', kind: 'clearAll', sceneName: 'Pódio 2025' }),
      obsSceneNames: scenesOfTheStreamPcObs,
      isWarned: false,
    },
  ];

  it.each(warningScenarios)('$name', ({ draft, obsSceneNames, isWarned }) => {
    // Arrange: the row and OBS's list from the table above.

    // Act: ask whether the row's scene is missing from OBS now.
    const result = isTheSceneOfTheRowMissingFromObsNow(draft, obsSceneNames);

    // Assert: warned exactly when a picked scene is not in OBS's list.
    expect(result, 'the warning must follow OBS’s list').toBe(isWarned);
  });
});

describe('buildMacroStepDraftsFromSteps', () => {
  it('turns stored steps into rows that build the very same steps', () => {
    // Arrange: a stored macro's five kinds of step, and a counter for the rows' ids.
    const storedSteps: MacroStep[] = [
      { kind: 'takeItem', itemId: 'item-relogio-enduro' },
      { kind: 'wait', ms: 1250 },
      { kind: 'clearLayer', layerId: 'lower-third' },
      { kind: 'clearAll' },
      { kind: 'obsScene', sceneName: 'Pódio', target: 'preview' },
    ];
    let rowsMadeSoFar = 0;
    function createDraftId(): string {
      rowsMadeSoFar += 1;
      return `passo-${rowsMadeSoFar}`;
    }

    // Act: turn them into rows, and the rows back into steps.
    const drafts = buildMacroStepDraftsFromSteps(storedSteps, createDraftId);
    const result = buildMacroStepsFromDrafts(drafts);

    // Assert: each row shows its step (the wait in seconds), and nothing is lost.
    expect(drafts, 'each step must become one row with its own id').toEqual([
      buildDraft({ draftId: 'passo-1', kind: 'takeItem', itemId: 'item-relogio-enduro' }),
      buildDraft({ draftId: 'passo-2', kind: 'wait', waitSecondsText: '1,25' }),
      buildDraft({ draftId: 'passo-3', kind: 'clearLayer', layerId: 'lower-third' }),
      buildDraft({ draftId: 'passo-4', kind: 'clearAll' }),
      buildDraft({
        draftId: 'passo-5',
        kind: 'obsScene',
        sceneName: 'Pódio',
        obsTarget: 'preview',
      }),
    ]);
    expect(result, 'the rows must build back the stored steps exactly').toEqual({
      isValid: true,
      steps: storedSteps,
    });
  });
});

describe('formatWaitMillisecondsAsSecondsText', () => {
  const scenarios = [
    // Half a second, with the pt-BR comma.
    { name: '500 ms reads 0,5', milliseconds: 500, expected: '0,5' },
    // Whole seconds have no decimal part.
    { name: '2000 ms reads 2', milliseconds: 2000, expected: '2' },
    // Trailing zeros are dropped.
    { name: '1250 ms reads 1,25', milliseconds: 1250, expected: '1,25' },
    // The smallest wait keeps all three decimals.
    { name: '1 ms reads 0,001', milliseconds: 1, expected: '0,001' },
  ];

  it.each(scenarios)('$name', ({ milliseconds, expected }) => {
    // Arrange: the milliseconds from the table.

    // Act: write them in seconds.
    const text = formatWaitMillisecondsAsSecondsText(milliseconds);

    // Assert: as an operator writes them.
    expect(text, 'the wait must read in seconds with a comma').toBe(expected);
  });
});
