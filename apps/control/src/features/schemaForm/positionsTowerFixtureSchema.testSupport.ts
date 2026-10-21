// Test support: the data schema of a positions tower (the list of cars in race order, on
// the right-hand column), written the way a graphic's manifest writes it. The real tower
// (packages/graphics/positions-tower) is not read here on purpose: these tests prove the
// generated form handles any manifest with a list field, a dropdown and switches, and a
// manifest that changes its wording must not break them. Each function builds new objects
// on every call, so no test can change what another test sees.
import { describeSchemaFormFromDataSchema } from './describeSchemaFormFromDataSchema';
import type { SchemaFormDescription } from './schemaFormDescription';

/**
 * The suggestion the tower's manifest makes for its list of cars: read the whole
 * positions list of a source, live. The editor pre-fills "Fonte" from it for a new item.
 */
export function buildSuggestedBindingOfTheCars(): Record<string, unknown> {
  return { shapeKey: 'positions', path: 'entries', isLive: true };
}

/**
 * The tower's data schema with `hintOfTheCars` as the `v_baja.suggestedBinding` of its
 * list of cars. Required: the list (`entries`). Optional: the layout (compact or
 * detailed), and four switches of the detailed layout's columns.
 */
export function buildPositionsTowerFixtureDataSchemaWithHint(
  hintOfTheCars: unknown,
): Record<string, unknown> {
  return {
    type: 'object',
    properties: {
      entries: {
        type: 'array',
        title: 'Carros',
        description: 'A lista de posições, lida de uma fonte de dados.',
        items: { type: 'object', additionalProperties: true },
        v_baja: { suggestedBinding: hintOfTheCars },
      },
      layout: {
        type: 'string',
        title: 'Leiaute',
        enum: ['compact', 'detailed'],
        gddOptions: { labels: { compact: 'Compacta', detailed: 'Detalhada' } },
        default: 'compact',
      },
      showGap: {
        type: 'boolean',
        title: 'Mostrar diferença para o líder',
        default: true,
      },
      showInterval: {
        type: 'boolean',
        title: 'Mostrar intervalo',
        default: true,
      },
      showPitStops: {
        type: 'boolean',
        title: 'Paradas',
        default: true,
      },
      showFuelStops: {
        type: 'boolean',
        title: 'Abastecimentos',
        default: false,
      },
    },
    required: ['entries'],
  };
}

/** The tower's data schema with the suggestion its manifest makes. */
export function buildPositionsTowerFixtureDataSchema(): Record<string, unknown> {
  return buildPositionsTowerFixtureDataSchemaWithHint(buildSuggestedBindingOfTheCars());
}

/** The tower's schema as the form reads it. */
export function describePositionsTowerFixtureForm(): SchemaFormDescription {
  return describeSchemaFormFromDataSchema(buildPositionsTowerFixtureDataSchema());
}
