/**
 * Tower columns (packages/graphics/positions-tower)
 *
 * What this module is for:
 *   The compact tower always draws the same six lanes (position, cue, car chip, team,
 *   laps, status). The detailed tower draws the same five plus the timing columns the
 *   operator switched on, and its grid and its width follow the columns shown, so a
 *   column turned off takes its width with it (the design's sheet-columns page). This
 *   module lists the columns shown for the settings and writes the grid template and the
 *   width from the theme's width tokens.
 *
 * What these tests prove:
 *   - Compact: the six lanes, whatever the column switches say.
 *   - Detailed with the defaults: pos, cue, car, team, laps, gap, interval, last lap,
 *     best lap, pit stops and status; the refuels only when switched on; an event
 *     without lap timing (the four time switches off) keeps laps and pit stops.
 *   - The grid template names each column's width token, with the team as
 *     `minmax(0, 1fr)` so a long name is cut and never widens the tower.
 *   - The width is a `calc()` adding every column's token (the team's `--col-team`) and
 *     the row padding on both sides, exactly as the design's generator wrote it.
 *
 * What these tests deliberately do not cover:
 *   - The pixel values of the tokens; the Playwright screenshots show the tower at its
 *     1072 px with the default columns.
 */
import { describe, expect, it } from 'vitest';

import type { TowerSettings } from './positionsTowerModel.js';
import {
  buildDetailedGridTemplate,
  buildDetailedTowerWidth,
  listColumnsShown,
} from './towerColumns.js';

/** The settings an item starts with: the manifest's defaults, in the detailed layout. */
function createDefaultDetailedSettings(): TowerSettings {
  return {
    layout: 'detailed',
    showGap: true,
    showInterval: true,
    showLastLap: true,
    showBestLap: true,
    showPitStops: true,
    showFuelStops: false,
    showStatus: true,
    paging: 'cycle',
  };
}

describe('listColumnsShown', () => {
  it('lists the six fixed lanes for the compact layout, whatever the switches say', () => {
    // Arrange: compact, with every detailed column switched off.
    const compactWithEverythingOff: TowerSettings = {
      ...createDefaultDetailedSettings(),
      layout: 'compact',
      showGap: false,
      showInterval: false,
      showLastLap: false,
      showBestLap: false,
      showPitStops: false,
      showStatus: false,
    };

    // Act: list the columns.
    const columnKeys = listColumnsShown(compactWithEverythingOff).map((column) => column.key);

    // Assert: the scoreboard's lanes, the status lane included.
    expect(columnKeys, 'the compact layout must always draw its six lanes').toEqual([
      'pos',
      'cue',
      'car',
      'team',
      'laps',
      'status',
    ]);
  });

  it('lists the default detailed columns: the five fixed ones, the times, the pit stops and the status', () => {
    // Arrange: the manifest's defaults in the detailed layout.
    const settings = createDefaultDetailedSettings();

    // Act: list the columns.
    const columnKeys = listColumnsShown(settings).map((column) => column.key);

    // Assert: everything but the refuels, in the design's order.
    expect(columnKeys, 'the default detailed tower must show every column but ABAST.').toEqual([
      'pos',
      'cue',
      'car',
      'team',
      'laps',
      'gap',
      'interval',
      'lastLap',
      'bestLap',
      'pitStops',
      'status',
    ]);
  });

  it('adds the refuels column between the pit stops and the status when switched on', () => {
    // Arrange: the defaults with the refuels on.
    const settings = { ...createDefaultDetailedSettings(), showFuelStops: true };

    // Act: list the columns.
    const columnKeys = listColumnsShown(settings).map((column) => column.key);

    // Assert: ABAST. sits after PARADAS and before the status lane.
    expect(columnKeys.slice(-3), 'ABAST. must come after PARADAS').toEqual([
      'pitStops',
      'fuelStops',
      'status',
    ]);
  });

  it('keeps laps and pit stops for an event without lap timing', () => {
    // Arrange: the four time switches off, as for an event with no timing per lap.
    const settings = {
      ...createDefaultDetailedSettings(),
      showGap: false,
      showInterval: false,
      showLastLap: false,
      showBestLap: false,
    };

    // Act: list the columns.
    const columnKeys = listColumnsShown(settings).map((column) => column.key);

    // Assert: the fixed five, the pit stops and the status.
    expect(columnKeys, 'an event without timing must show VOLTAS and PARADAS').toEqual([
      'pos',
      'cue',
      'car',
      'team',
      'laps',
      'pitStops',
      'status',
    ]);
  });
});

describe('buildDetailedGridTemplate', () => {
  it('names each column width token, with the team as minmax(0, 1fr)', () => {
    // Arrange: the default detailed columns.
    const columns = listColumnsShown(createDefaultDetailedSettings());

    // Act: write the grid template.
    const gridTemplate = buildDetailedGridTemplate(columns);

    // Assert: one token per column; the team takes what is left and never grows the tower.
    expect(gridTemplate, 'the grid must follow the columns shown').toBe(
      'var(--col-pos) var(--column-cue) var(--chip-width) minmax(0, 1fr) var(--col-laps) var(--col-gap) var(--col-interval) var(--col-last-lap) var(--col-best-lap) var(--col-pit-stops) var(--column-status)',
    );
  });
});

describe('buildDetailedTowerWidth', () => {
  it('adds every column token and the row padding on both sides', () => {
    // Arrange: an event without lap timing: five fixed columns, pit stops and status.
    const columns = listColumnsShown({
      ...createDefaultDetailedSettings(),
      showGap: false,
      showInterval: false,
      showLastLap: false,
      showBestLap: false,
    });

    // Act: write the width.
    const width = buildDetailedTowerWidth(columns);

    // Assert: a calc() the browser adds up from the tokens (668 px in Ardósia).
    expect(width, 'the width must add the columns shown and the padding').toBe(
      'calc(var(--col-pos) + var(--column-cue) + var(--chip-width) + var(--col-team) + var(--col-laps) + var(--col-pit-stops) + var(--column-status) + 2 * var(--row-padding))',
    );
  });
});
