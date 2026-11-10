/**
 * The team of "+ Evento" (BAJAOVRLAY-67), as pure changes of the form: a team picked from
 * Cadastros fills the car, team and school; "Sem equipe (aviso geral)" clears them; a
 * field changed by hand clears the pick; a car number typed by hand fills a blank team and
 * school from Cadastros. Kept apart from the dialog so each rule is tested on its own and
 * the dialog only draws.
 */
import type { Team } from '@bajaovrlay/shared';

import { listRecordsFoundBySearch } from '@/features/entityLibrary/recordSearch';
import { ptBR } from '@/i18n/ptBR';

import type { ManualEventFormValues } from './manualEventForm';

/** The value the team list keeps for "Sem equipe (aviso geral)": no car number is it. */
export const generalNoticeTeamChoice = 'sem-equipe';

/** The text fields a team fills, in the form's own names. */
type FieldATeamFills = 'carNumberText' | 'teamName' | 'schoolName';

/** One team as the list offers it: its car number as the value, and how it reads. */
export type TeamChoice = { value: string; optionName: string };

/** How a team reads in the list: "47 · Carnaúba Baja · UFERSA". */
function writeTeamOptionName(team: Team): string {
  return ptBR.events.manualForm.teamOption(team.carNumber, team.teamName, team.schoolName);
}

/**
 * The teams a search finds, by car number (the whole number), team or school (accents or
 * not), in car-number order, exactly as the item editor's "Cadastro" picker finds them.
 */
export function listTeamChoicesFoundBySearch(teams: Team[], searchText: string): TeamChoice[] {
  const library = { teams, people: [], sponsors: [], scheduleSlots: [] };
  const teamsFound = listRecordsFoundBySearch(library, 'team', searchText) as Team[];
  return teamsFound.map((team) => ({
    value: String(team.carNumber),
    optionName: writeTeamOptionName(team),
  }));
}

/** The team of Cadastros with this car number typed, or undefined. */
function findTeamOfTypedCarNumber(teams: Team[], carNumberText: string): Team | undefined {
  const trimmedText = carNumberText.trim();
  if (!/^\d+$/.test(trimmedText)) {
    return undefined;
  }
  return teams.find((team) => team.carNumber === Number(trimmedText));
}

/**
 * The form after a choice in the team list: a team fills the car, team and school as its
 * own (an edit of them later is the operator's); the general notice clears them, since a
 * notice about the event has none. A choice no team has (a team deleted meanwhile)
 * changes nothing.
 */
export function chooseTeamInForm(
  values: ManualEventFormValues,
  choice: string,
  teams: Team[],
): ManualEventFormValues {
  if (choice === generalNoticeTeamChoice) {
    return {
      ...values,
      teamChoice: generalNoticeTeamChoice,
      carNumberText: '',
      teamName: '',
      schoolName: '',
      fieldsFilledFromTheCarNumber: [],
    };
  }
  const team = teams.find((candidate) => String(candidate.carNumber) === choice);
  if (team === undefined) {
    return values;
  }
  return {
    ...values,
    teamChoice: choice,
    carNumberText: String(team.carNumber),
    teamName: team.teamName,
    schoolName: team.schoolName,
    fieldsFilledFromTheCarNumber: [],
  };
}

/**
 * The form after the operator changed one of the car, team or school by hand. The pick
 * is cleared (the form no longer matches the team it named) and the other two kept. A
 * team or school typed becomes the operator's own. A car number typed fills a team and
 * school that are blank, or were filled by an earlier number, from its team in Cadastros
 * (or clears what an earlier number filled, when no team has it); what the operator typed
 * is never overwritten.
 */
export function changeFieldATeamFills(
  values: ManualEventFormValues,
  field: FieldATeamFills,
  text: string,
  teams: Team[],
): ManualEventFormValues {
  const valuesAfter: ManualEventFormValues = { ...values, [field]: text, teamChoice: '' };
  if (field !== 'carNumberText') {
    valuesAfter.fieldsFilledFromTheCarNumber = values.fieldsFilledFromTheCarNumber.filter(
      (filledField) => filledField !== field,
    );
    return valuesAfter;
  }
  const teamOfTheNumber = findTeamOfTypedCarNumber(teams, text);
  const fieldsFilledNow: Array<'teamName' | 'schoolName'> = [];
  for (const fieldOfTheTeam of ['teamName', 'schoolName'] as const) {
    const isBlank = values[fieldOfTheTeam].trim() === '';
    const wasFilledByANumber = values.fieldsFilledFromTheCarNumber.includes(fieldOfTheTeam);
    if (!isBlank && !wasFilledByANumber) {
      continue;
    }
    valuesAfter[fieldOfTheTeam] = teamOfTheNumber?.[fieldOfTheTeam] ?? '';
    if (teamOfTheNumber !== undefined) {
      fieldsFilledNow.push(fieldOfTheTeam);
    }
  }
  valuesAfter.fieldsFilledFromTheCarNumber = fieldsFilledNow;
  return valuesAfter;
}
