/**
 * Test support: the 30ª Competição's 17 sponsors as Cadastros' entity list gives them, each
 * logo a /media address (BAJAOVRLAY-46). The one copy of the real round the kit's and the
 * graphics' tests use; the names, levels and plates are the preview sample's.
 */
import {
  createThe30thCompetitionSponsorsSample,
  type SampleSponsor,
} from './the30thCompetitionSponsorsSample.js';

/** The 17 in the server's order, each logo at /media/logo-<name in lower case>. */
export function createThe30thCompetitionSponsors(): SampleSponsor[] {
  return createThe30thCompetitionSponsorsSample().map((sponsor) => ({
    ...sponsor,
    logoUrl: `/media/logo-${sponsor.name.toLowerCase()}`,
  }));
}
