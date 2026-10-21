/**
 * The columns of the tower: which are shown for the settings, and the detailed grid
 * template and width written from the theme's width tokens, following the design's
 * column registry (docs/design, slateTemplates.mjs). A column turned off takes its width
 * with it, so the detailed tower is exactly as wide as what it shows.
 */
import type { TowerColumnKey, TowerSettings } from './positionsTowerModel.js';

/** One column: its key, the width token the grid and the width use, and whether it is fixed. */
export type TowerColumn = {
  key: TowerColumnKey;
  /** The theme token of the column's width, as `var(--col-gap)`. */
  widthToken: string;
  /** True for the five columns the detailed layout always has. */
  isAlwaysShown: boolean;
};

/** Every column the detailed tower can show, in the order they are laid out. */
const detailedColumnRegistry: TowerColumn[] = [
  { key: 'pos', widthToken: 'var(--col-pos)', isAlwaysShown: true },
  { key: 'cue', widthToken: 'var(--column-cue)', isAlwaysShown: true },
  { key: 'car', widthToken: 'var(--chip-width)', isAlwaysShown: true },
  { key: 'team', widthToken: 'var(--col-team)', isAlwaysShown: true },
  { key: 'laps', widthToken: 'var(--col-laps)', isAlwaysShown: true },
  { key: 'gap', widthToken: 'var(--col-gap)', isAlwaysShown: false },
  { key: 'interval', widthToken: 'var(--col-interval)', isAlwaysShown: false },
  { key: 'lastLap', widthToken: 'var(--col-last-lap)', isAlwaysShown: false },
  { key: 'bestLap', widthToken: 'var(--col-best-lap)', isAlwaysShown: false },
  { key: 'pitStops', widthToken: 'var(--col-pit-stops)', isAlwaysShown: false },
  { key: 'fuelStops', widthToken: 'var(--col-refuels)', isAlwaysShown: false },
  { key: 'status', widthToken: 'var(--column-status)', isAlwaysShown: false },
];

/**
 * The compact layout's six lanes: the scoreboard's columns plus the status lane, always
 * there. Their widths live in the styles (the compact grid is fixed), so the tokens here
 * are only informative.
 */
const compactColumns: TowerColumn[] = [
  { key: 'pos', widthToken: 'var(--column-pos)', isAlwaysShown: true },
  { key: 'cue', widthToken: 'var(--column-cue)', isAlwaysShown: true },
  { key: 'car', widthToken: 'var(--chip-width)', isAlwaysShown: true },
  { key: 'team', widthToken: 'var(--column-width)', isAlwaysShown: true },
  { key: 'laps', widthToken: 'var(--column-laps)', isAlwaysShown: true },
  { key: 'status', widthToken: 'var(--column-status)', isAlwaysShown: true },
];

/** Whether an optional detailed column is switched on in the settings. */
function isOptionalColumnSwitchedOn(column: TowerColumn, settings: TowerSettings): boolean {
  switch (column.key) {
    case 'gap':
      return settings.showGap;
    case 'interval':
      return settings.showInterval;
    case 'lastLap':
      return settings.showLastLap;
    case 'bestLap':
      return settings.showBestLap;
    case 'pitStops':
      return settings.showPitStops;
    case 'fuelStops':
      return settings.showFuelStops;
    case 'status':
      return settings.showStatus;
    default:
      return column.isAlwaysShown;
  }
}

/** The columns the tower draws for the settings, in layout order. */
export function listColumnsShown(settings: TowerSettings): TowerColumn[] {
  if (settings.layout === 'compact') {
    return compactColumns;
  }
  return detailedColumnRegistry.filter(
    (column) => column.isAlwaysShown || isOptionalColumnSwitchedOn(column, settings),
  );
}

/**
 * The detailed rows' `grid-template-columns`: one width token per column, the team as
 * `minmax(0, 1fr)` so a long name is cut inside its column and never widens the tower.
 */
export function buildDetailedGridTemplate(columns: TowerColumn[]): string {
  const tracks = columns.map((column) =>
    column.key === 'team' ? 'minmax(0, 1fr)' : column.widthToken,
  );
  return tracks.join(' ');
}

/**
 * The detailed tower's width: every column's token (the team's `--col-team`, which the
 * grid leaves flexible) plus the row padding on both sides, as a `calc()` the browser
 * adds up from the theme. With the default columns Ardósia gives 1072 px.
 */
export function buildDetailedTowerWidth(columns: TowerColumn[]): string {
  const widthTokens = columns.map((column) => column.widthToken);
  return `calc(${widthTokens.join(' + ')} + 2 * var(--row-padding))`;
}
