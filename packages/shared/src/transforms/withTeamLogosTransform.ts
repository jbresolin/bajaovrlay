import type { Team } from '../entities/team.js';
import { buildMediaUrl } from '../media/mediaId.js';
import { ptBRTransforms } from './ptBRTransforms.js';
import { quoteValueForReason } from './quoteValueForReason.js';
import {
  type BindingTransform,
  type BindingTransformContext,
  giveTransformedValue,
  type JsonValue,
  refuseTransformValue,
  type TransformResult,
} from './transform.js';

/** Says whether a list entry is a plain object, so its car number can be read. */
function isPlainObject(value: unknown): value is Record<string, JsonValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * One entry with its team's logo added: `logoUrl` (the image's /media address) and
 * `logoOnLightPlate` (yes or no, left out in Cadastros meaning no). An entry whose car has
 * no team, or whose team has no logo, is handed back as it came: the podium then draws the
 * card with no logo row, and nothing is invented.
 */
function addTeamLogoToEntry(entry: unknown, teams: readonly Team[]): JsonValue {
  if (!isPlainObject(entry)) {
    return entry as JsonValue;
  }
  const teamOfTheCar = teams.find((team) => team.carNumber === entry.carNumber);
  if (teamOfTheCar?.logoMediaId === undefined) {
    return entry;
  }
  return {
    ...entry,
    logoUrl: buildMediaUrl(teamOfTheCar.logoMediaId),
    logoOnLightPlate: teamOfTheCar.logoOnLightPlate === true,
  };
}

/**
 * Joins the teams of the library into a positions or standings list by car number (the
 * key both share), adding each team's logo; the order and every other field stay as they
 * are. Anything but a list is refused. Pure: the teams come in the context, never read
 * from anywhere, so the same list and teams always give the same list.
 */
function addTeamLogosToList(value: unknown, context: BindingTransformContext): TransformResult {
  if (!Array.isArray(value)) {
    return refuseTransformValue(ptBRTransforms.reasons.notAList(quoteValueForReason(value)));
  }
  const entriesWithLogos = value.map((entry: unknown) => addTeamLogoToEntry(entry, context.teams));
  return giveTransformedValue(entriesWithLogos);
}

/** The podium's three cars, each crowned by its team's logo from Cadastros (BAJAOVRLAY-47). */
export const withTeamLogosTransform: BindingTransform = {
  id: 'withTeamLogos',
  family: 'binding',
  label: ptBRTransforms.transforms.withTeamLogos.label,
  description: ptBRTransforms.transforms.withTeamLogos.description,
  valueTypesRead: ['positionsEntries', 'standingsEntries'],
  valueTypeGiven: 'sameAsTheValueRead',
  readsTheTeams: true,
  apply: (value, _parameters, context) => addTeamLogosToList(value, context),
};
