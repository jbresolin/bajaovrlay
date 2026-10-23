// The simulator's fictional teams as team records of the entity library, for
// "Importar equipes do simulador".
import { BrazilianStateCodeSchema, type Team, TeamSchema } from '@bajaovrlay/shared';
import { z } from 'zod';

import { listFictionalTeams } from '../dataSources/index.js';
import placesFile from './simulatorSchoolPlaces.json' with { type: 'json' };

/** What the Cadastros page is told about these teams, shown beside the button. */
export const simulatorTeamsNotice =
  'Equipes fictícias do simulador, para ensaios: nunca mostrar como resultado real.';

const SchoolPlacesFileSchema = z.object({
  notice: z.string().min(1),
  places: z.record(
    z.string().min(1),
    z.object({ city: z.string().min(1), state: BrazilianStateCodeSchema }),
  ),
});

// Checked once when the server loads this file, as teams.fictional.json is: a school
// with no place, or a place with a wrong UF, stops the server at boot instead of
// breaking the import on the day.
const schoolPlaces = SchoolPlacesFileSchema.parse(placesFile).places;

/**
 * The simulator's hundred fictional teams as team records: car 1 is the first team of
 * teams.fictional.json, as in the simulated race, so a simulated car and its imported
 * team join by number. Each gets the city and state of its school
 * (simulatorSchoolPlaces.json) and no image. Each record passes TeamSchema here, so a
 * broken file is found at the first call rather than by an import refused on air.
 */
export function buildSimulatorTeamsAsEntities(): Team[] {
  return listFictionalTeams().map((fictionalTeam, carIndex) => {
    const place = schoolPlaces[fictionalTeam.schoolName];
    if (place === undefined) {
      throw new Error(`the simulator's school ${fictionalTeam.schoolName} has no place`);
    }
    return TeamSchema.parse({
      carNumber: carIndex + 1,
      teamName: fictionalTeam.teamName,
      schoolName: fictionalTeam.schoolName,
      city: place.city,
      state: place.state,
    });
  });
}
