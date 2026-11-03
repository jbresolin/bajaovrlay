// Test support: reads the Baja app's results API answers kept in examples/bajaApp/ (real
// ones saved with curl, the doc's examples, one made-up bracket; see its README).
import { readFileSync } from 'node:fs';

/** The fixture files, by what each one is. */
export const bajaAppFixtureFiles = {
  teams26BR: 'equipes-26BR.json',
  teams26SE: 'equipes-26SE.json',
  teams25SU: 'equipes-25SU.json',
  overall26BR: 'resultado-26BR_GER.json',
  enduroTable26BR: 'resultado-26BR_END.json',
  staticSafetyTableRankingNobody26BR: 'resultado-26BR_SGE.json',
  enduroTableWithANullHeader26BR: 'resultado-26BR_END-null-header.made-up.json',
  enduroTableWithNoRankingColumn26BR: 'resultado-26BR_END-no-ranking-column.made-up.json',
  overallDuringSpoilers25SU: 'resultado-25SU_GER-spoilers.from-doc.json',
  superPrime26BR: 'torneio-26BR_SPR.json',
  superPrime25SU: 'torneio-25SU_SPR.json',
  superPrime25SUWithPendingSlots: 'torneio-25SU_SPR-pending.made-up.json',
  raceTenMinutesIn00NE: 'corrida-00NE_ZZL.from-doc.json',
  raceBeforeTheStart26BR: 'corrida-26BR_END-waiting.from-doc.json',
  event26BR: 'evento-26BR.json',
  event26BRDuringTheEvent: 'evento-26BR-during-the-event.made-up.json',
} as const;

/** Reads one fixture of examples/bajaApp/ as the API answered it. */
export function readBajaAppFixture(fileName: string): Record<string, unknown> {
  const fixtureUrl = new URL(`./examples/bajaApp/${fileName}`, import.meta.url);
  return JSON.parse(readFileSync(fixtureUrl, 'utf8')) as Record<string, unknown>;
}
