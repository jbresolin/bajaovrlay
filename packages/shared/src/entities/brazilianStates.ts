import { z } from 'zod';

import { ptBREntities } from './ptBREntities.js';

/**
 * The 26 states and the Federal District, by the two capital letters the team card
 * prints after the city ("Curitiba – PR"). Capitals only: "pr" is a typo the operator
 * fixes, never guessed, so two copies of one team never differ by a letter's case.
 */
export const BrazilianStateCodeSchema = z.enum(
  [
    'AC',
    'AL',
    'AP',
    'AM',
    'BA',
    'CE',
    'DF',
    'ES',
    'GO',
    'MA',
    'MT',
    'MS',
    'MG',
    'PA',
    'PB',
    'PR',
    'PE',
    'PI',
    'RJ',
    'RN',
    'RS',
    'RO',
    'RR',
    'SC',
    'SP',
    'SE',
    'TO',
  ],
  { error: ptBREntities.recordProblems.unknownState },
);

/** One of BrazilianStateCodeSchema's values. */
export type BrazilianStateCode = z.infer<typeof BrazilianStateCodeSchema>;
