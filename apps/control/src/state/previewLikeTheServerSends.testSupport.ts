// Test support: instances on the preview output, as the server sends them once an
// operator has previewed something. A preview is an ordinary instance with
// `target: 'preview'` and a `previewOrigin` saying who asked for it; its status stays
// `loading` for good, because the pages that draw previews never report. Like the other *LikeTheServerSends files, every function builds
// new objects on every call, so no test can change what another test sees.
import type { Instance } from '@bajaovrlay/shared';

import { lowerThirdFixtureGraphicId } from './lowerThirdFixtureGraphic.testSupport';

/** The id the server gave the race clock preview of these tests. */
export const idOfTheRaceClockPreview = '2b7e4c10-9d3a-4f6b-8c21-7a5e0d4f1b93';
/** The id the server gave the lower third preview of these tests. */
export const idOfTheLowerThirdPreview = '8f1d6a37-5c2e-4b90-a4d8-3e9b7c6f2a15';

/**
 * The race clock on the PREVIEW output of the clock layer, made from a rundown item the
 * operator asked to see (`previewItem`, by hand): it carries that item's id, and the
 * reference moment the server stamped at the preview, which a take stamps again.
 */
export function buildRaceClockPreviewOfItem(itemId: string, previewedAt: string): Instance {
  return {
    id: idOfTheRaceClockPreview,
    layerId: 'clock',
    graphicId: 'race-clock',
    target: 'preview',
    resolvedData: {
      sessionName: 'Enduro de Resistência',
      state: 'green',
      clockMode: 'elapsed',
      referenceTimeMs: 0,
      referenceWallClockMs: Date.parse(previewedAt),
      running: true,
    },
    currentStep: 0,
    status: 'loading',
    takenAt: previewedAt,
    previewOrigin: 'manual',
    itemId,
    takeTimeFieldKeys: ['referenceWallClockMs'],
  };
}

/**
 * A lower third on the PREVIEW output of the "Tarja" layer, previewed from an item that
 * was deleted since (the page holds no item of that id), so the page names it by its
 * graphic. (Until BAJAOVRLAY-37 this stood for a preview made by hand, with no item.)
 */
export function buildLowerThirdPreviewWhoseItemIsGone(previewedAt: string): Instance {
  return {
    id: idOfTheLowerThirdPreview,
    layerId: 'lower-third',
    graphicId: lowerThirdFixtureGraphicId,
    target: 'preview',
    resolvedData: {
      nome: 'Marina Tavares',
      cargo: 'Capitã',
      equipe: 'baja-ufpr',
      duracaoMs: 8_000,
      destaque: false,
      numeroDoCarro: 42,
    },
    currentStep: 0,
    status: 'loading',
    takenAt: previewedAt,
    previewOrigin: 'manual',
    itemId: 'item-tarja-excluida',
  };
}
