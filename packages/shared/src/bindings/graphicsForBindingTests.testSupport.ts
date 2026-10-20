// Graphics the binding tests bind fields of: the real race clock, read from its package's
// manifest as the server reads it, and a small positions tower written here, because the
// catalogue has no graphic with a list field yet (BAJAOVRLAY-21 builds the tower).
import { readFileSync } from 'node:fs';

import type { Graphic, OGrafManifest } from '../slices/graphic.js';

/** The race clock as the graphics slice lists it, from packages/graphics/race-clock. */
export function buildRaceClockGraphicFromItsManifest(): Graphic {
  const manifestUrl = new URL(
    '../../../graphics/race-clock/race-clock.ograf.json',
    import.meta.url,
  );
  const manifest = JSON.parse(readFileSync(manifestUrl, 'utf8')) as OGrafManifest;
  return {
    id: 'race-clock',
    manifest,
    defaultLayerId: 'clock',
    category: 'clock',
    thumbnailUrl: null,
    defaultFields: {},
  };
}

/**
 * A positions tower with a title, the list of cars, how many to show and whether the
 * gaps are shown: one field of each kind a binding can fill that the race clock lacks.
 */
export function buildPositionsTowerGraphic(): Graphic {
  return {
    id: 'positions-tower',
    manifest: {
      id: 'baja-positions-tower',
      name: 'Torre de posições',
      main: 'positions-tower.js',
      schema: {
        type: 'object',
        properties: {
          title: { type: 'string', title: 'Título' },
          entries: { type: 'array', title: 'Carros', items: { type: 'object' } },
          carsShown: { type: 'integer', title: 'Carros mostrados', minimum: 1 },
          leaderPoints: { type: 'number', title: 'Pontos do líder' },
          areGapsShown: { type: 'boolean', title: 'Mostrar diferenças' },
          theme: { type: 'object', title: 'Tema' },
        },
        required: ['title', 'entries'],
      },
    },
    defaultLayerId: 'fullscreen',
    category: 'standings',
    thumbnailUrl: null,
    defaultFields: {},
  };
}
