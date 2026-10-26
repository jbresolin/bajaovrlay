/**
 * deleteLayer, its guards, and a graphic whose default layer goes (apps/server)
 *
 * What this module is for:
 *   A layer the operator no longer needs is deleted on "Saídas e camadas" (BAJAOVRLAY-49).
 *   Deleting one that something still uses would leave a graphic on air with no
 *   container, or an item, a button, a macro or an event rule pointing at nothing that
 *   fails only when pressed mid-show. So the delete is refused while anything uses the
 *   layer, and the pt-BR reason lists what does. A graphic's default layer is different:
 *   it is only the editor's first choice, so it does not block the delete; the graphic
 *   falls back to the fullscreen layer, as it does at boot, and the server logs it.
 *
 * What these tests prove (on the pure reducer, through reduceCommand):
 *   - A layer nothing uses is deleted; the other layers stay as they were.
 *   - Refused, one row per guard: a graphic on air, a graphic in preview, a "vai limpar"
 *     mark, an item of a rundown, a quick-fire button, a macro step and an event rule
 *     (through its item), each named in the reason.
 *   - With several uses at once the reason lists every kind, counted, with their names.
 *   - A graphic whose default layer was deleted defaults to the fullscreen layer, and the
 *     outcome names it so the store can log a warning; the items keep their own layer.
 *   - Deleting the fullscreen layer itself leaves such a graphic with no default the
 *     editor can use, which the editor then asks for.
 *
 * What these tests deliberately do not cover:
 *   - The store's warning line and the event-log row; outputsThroughTheStore.test.ts.
 *   - The confirmation dialog's "N gráficos usam esta camada como padrão"; the control page.
 */
import type { EventRule, Item } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { reduceCommand } from '../../core/store/reducers/reduceCommand.js';
import type { SlicesChangedByCommands } from '../../core/store/reducers/reducerTypes.js';
import { contextOfTheRundownCommand } from '../../core/store/reducers/rundownSlices.testSupport.js';
import {
  buildCloseThePipMacro,
  buildPipCaptionItem,
  buildPipCaptionOnAir,
  buildRaceDaySlicesWithPip,
} from './outputSlices.testSupport.js';

/** "Legenda PiP — atalho": the caption as a button of "Atalhos". */
function buildPipCaptionShortcut(): Item {
  return {
    ...buildPipCaptionItem(0),
    id: 'item-atalho-legenda-pip',
    home: { kind: 'quickFire', panelId: 'atalhos' },
    label: 'Legenda PiP — atalho',
  };
}

/** The fastest-lap rule, showing its notice with the caption shortcut. */
function buildFastestLapRuleShowingTheShortcut(): EventRule {
  return {
    kind: 'fastestLap',
    mode: 'ask',
    itemId: 'item-atalho-legenda-pip',
    durationMs: 8000,
    maxAgeMs: null,
  };
}

/** The race day with the fastest-lap rule pointing at the caption shortcut. */
function buildSlicesWithTheShortcutAndItsRule(): SlicesChangedByCommands {
  return {
    ...buildRaceDaySlicesWithPip({ items: [buildPipCaptionShortcut()] }),
    eventRules: [buildFastestLapRuleShowingTheShortcut()],
  };
}

describe('deleteLayer', () => {
  it('deletes a layer nothing uses and leaves the others as they were', () => {
    // Arrange: program and PiP, nothing on air, no item.
    const slicesBefore = buildRaceDaySlicesWithPip({});

    // Act: delete the PiP's caption.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'deleteLayer', layerId: 'legenda-pip' },
      contextOfTheRundownCommand,
    );

    // Assert: every layer but the caption, in the same order.
    expect(outcome.status === 'applied' && outcome.slices.layers, 'the caption is gone').toEqual(
      slicesBefore.layers.filter((layer) => layer.id !== 'legenda-pip'),
    );
  });
});

const deleteRefusalScenarios: Array<{
  name: string;
  buildSlices: () => SlicesChangedByCommands;
  code: string;
  message: string;
}> = [
  // A graphic on air with no container would vanish from the PiP scene mid-show.
  {
    name: 'a graphic on air',
    buildSlices: () => buildRaceDaySlicesWithPip({ instances: [buildPipCaptionOnAir()] }),
    code: 'LAYER_NOT_EMPTY',
    message:
      'A camada "Legenda" não pode ser excluída: tem um gráfico no ar. Limpe a camada antes.',
  },
  // A preview one "Tomar" away from air.
  {
    name: 'a graphic in preview',
    buildSlices: () =>
      buildRaceDaySlicesWithPip({ instances: [{ ...buildPipCaptionOnAir(), target: 'preview' }] }),
    code: 'LAYER_NOT_EMPTY',
    message:
      'A camada "Legenda" não pode ser excluída: tem um gráfico em prévia. Limpe a camada antes.',
  },
  // A "vai limpar" mark is a promise the next take keeps on this layer.
  {
    name: 'a "vai limpar" mark',
    buildSlices: () => buildRaceDaySlicesWithPip({ previewClearedLayerIds: ['legenda-pip'] }),
    code: 'LAYER_NOT_EMPTY',
    message:
      'A camada "Legenda" não pode ser excluída: está marcada "vai limpar" na Prévia. Limpe a camada antes.',
  },
  // An item of the rundown would be refused at its take, in front of everyone.
  {
    name: 'an item of a rundown',
    buildSlices: () => buildRaceDaySlicesWithPip({ items: [buildPipCaptionItem(0)] }),
    code: 'LAYER_IN_USE',
    message:
      'A camada "Legenda" não pode ser excluída. Usada por 1 item: "Legenda PiP — Baja UFPR". Mude ou exclua o que usa a camada antes.',
  },
  // A quick-fire button the same.
  {
    name: 'a quick-fire button',
    buildSlices: () => buildRaceDaySlicesWithPip({ items: [buildPipCaptionShortcut()] }),
    code: 'LAYER_IN_USE',
    message:
      'A camada "Legenda" não pode ser excluída. Usada por 1 atalho: "Legenda PiP — atalho". Mude ou exclua o que usa a camada antes.',
  },
  // A macro would stop at that step mid-run.
  {
    name: 'a macro step',
    buildSlices: () => buildRaceDaySlicesWithPip({ macros: [buildCloseThePipMacro()] }),
    code: 'LAYER_IN_USE',
    message:
      'A camada "Legenda" não pode ser excluída. Usada por 1 macro: "Fechar PiP". Mude ou exclua o que usa a camada antes.',
  },
];

describe('the refusals of deleteLayer', () => {
  it.each(deleteRefusalScenarios)(
    'refuses while the layer has $name',
    ({ buildSlices, code, message }) => {
      // Arrange: the race day with that one use of the PiP's caption.
      const slicesBefore = buildSlices();

      // Act: try to delete the caption.
      const outcome = reduceCommand(
        slicesBefore,
        { type: 'deleteLayer', layerId: 'legenda-pip' },
        contextOfTheRundownCommand,
      );

      // Assert: refused with its code and a reason that names the use.
      expect(outcome, 'the delete must be refused, saying why').toEqual({
        status: 'refused',
        error: { code, message },
      });
    },
  );

  it('names an event rule that shows its notice on the layer, through its item', () => {
    // Arrange: the caption shortcut, which the fastest-lap rule shows its notice with.
    const slicesBefore = buildSlicesWithTheShortcutAndItsRule();

    // Act: try to delete the caption.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'deleteLayer', layerId: 'legenda-pip' },
      contextOfTheRundownCommand,
    );

    // Assert: the shortcut and the rule are both named.
    expect(
      outcome.status === 'refused' && outcome.error.message,
      'the rule that would show a notice there is named by its kind',
    ).toBe(
      'A camada "Legenda" não pode ser excluída. Usada por 1 atalho: "Legenda PiP — atalho"; 1 regra de eventos: "Volta mais rápida". Mude ou exclua o que usa a camada antes.',
    );
  });

  it('lists every kind of use at once, counted, with their names', () => {
    // Arrange: two rundown items, the shortcut, the macro and the rule, all on the caption.
    const secondCaptionItem: Item = {
      ...buildPipCaptionItem(1),
      id: 'item-legenda-pip-equipe-7',
      label: 'Legenda PiP — Equipe 7',
    };
    const slicesBefore = {
      ...buildSlicesWithTheShortcutAndItsRule(),
      items: [buildPipCaptionItem(0), secondCaptionItem, buildPipCaptionShortcut()],
      macros: [buildCloseThePipMacro()],
    };

    // Act: try to delete the caption.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'deleteLayer', layerId: 'legenda-pip' },
      contextOfTheRundownCommand,
    );

    // Assert: one reason naming all of them, items first.
    expect(
      outcome.status === 'refused' && outcome.error.message,
      'every use is listed, so the operator knows what to change',
    ).toBe(
      'A camada "Legenda" não pode ser excluída. Usada por 2 itens: "Legenda PiP — Baja UFPR", "Legenda PiP — Equipe 7"; 1 atalho: "Legenda PiP — atalho"; 1 macro: "Fechar PiP"; 1 regra de eventos: "Volta mais rápida". Mude ou exclua o que usa a camada antes.',
    );
  });

  it('refuses a layer that does not exist', () => {
    // Arrange: program and PiP.
    const slicesBefore = buildRaceDaySlicesWithPip({});

    // Act: delete a layer another operator already deleted.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'deleteLayer', layerId: 'placar-pip' },
      contextOfTheRundownCommand,
    );

    // Assert: refused as an unknown layer.
    expect(outcome, 'an unknown layer is refused').toEqual({
      status: 'refused',
      error: { code: 'LAYER_NOT_FOUND', message: 'A camada "placar-pip" não existe.' },
    });
  });
});

describe('a graphic whose default layer is deleted', () => {
  it('defaults to the fullscreen layer, and the outcome names it for the log', () => {
    // Arrange: the team lower third's default is the program's lower third, and an item
    // of it was moved to the PiP's caption by hand.
    const slicesBefore = buildRaceDaySlicesWithPip({ items: [buildPipCaptionItem(0)] });

    // Act: delete the program's lower third, which no item names.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'deleteLayer', layerId: 'lower-third' },
      contextOfTheRundownCommand,
    );

    // Assert: the graphic now defaults to fullscreen, the outcome names it, and the item
    // keeps the layer it chose.
    expect(
      outcome.status === 'applied' &&
        outcome.slices.graphics.find((graphic) => graphic.id === 'team-lower-third')
          ?.defaultLayerId,
      'the graphic falls back to fullscreen, as at boot',
    ).toBe('fullscreen');
    expect(
      outcome.status === 'applied' && outcome.graphicsPlacedOnTheFallbackLayer,
      'the outcome names the graphic, so the store logs a warning',
    ).toEqual(['team-lower-third']);
    expect(
      outcome.status === 'applied' && outcome.slices.items,
      'an item keeps its explicit layer',
    ).toBe(slicesBefore.items);
  });

  it('leaves the default on the deleted fullscreen layer, for the editor to ask', () => {
    // Arrange: a graphic whose default is the fullscreen layer.
    const slicesWithoutAFullscreenGraphic = buildRaceDaySlicesWithPip({});
    const slicesBefore = {
      ...slicesWithoutAFullscreenGraphic,
      graphics: slicesWithoutAFullscreenGraphic.graphics.map((graphic) =>
        graphic.id === 'team-lower-third' ? { ...graphic, defaultLayerId: 'fullscreen' } : graphic,
      ),
    };

    // Act: delete the fullscreen layer itself.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'deleteLayer', layerId: 'fullscreen' },
      contextOfTheRundownCommand,
    );

    // Assert: deleted; there is nowhere left to fall back to, so the graphics are as they
    // were and nothing is named.
    expect(outcome.status, 'the fullscreen layer may be deleted too').toBe('applied');
    expect(
      outcome.status === 'applied' && outcome.slices.graphics,
      'the graphics are untouched: the editor asks for a layer',
    ).toBe(slicesBefore.graphics);
    expect(
      outcome.status === 'applied' && outcome.graphicsPlacedOnTheFallbackLayer,
      'no graphic was moved',
    ).toBeUndefined();
  });
});
