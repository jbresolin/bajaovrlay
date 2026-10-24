/**
 * A sponsor's choice of the light plate for its logo (packages/shared)
 *
 * What this module is for:
 *   The sponsor bug puts a dark sponsor logo, or one that comes on its own white box, on a
 *   small light plate: the team card's rule (BAJAOVRLAY-24) given to sponsors
 *   (BAJAOVRLAY-23). Whether a sponsor's logo needs it is decided by hand, once per sponsor,
 *   in Cadastros or in the CSV: `logoOnLightPlate`, optional, left out meaning no.
 *
 * What these tests prove:
 *   - A sponsor marked for the plate keeps the choice, and a sponsor that says nothing (one
 *     stored before the choice existed, or a CSV row without the column) is left as it is.
 *   - A choice that is not yes or no is refused with a pt-BR sentence naming the field.
 *   - The choice is an attribute an item can read, as a yes or no, beside the logo.
 *
 * What these tests deliberately do not cover:
 *   - Reading the choice into a graphic; entityReferenceResolution.test.ts.
 *   - The CSV's "sim" and "não"; the control page's entityCsvImport.test.ts.
 *   - A stored sponsors row booting; the server's sponsorPlateAtBoot.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { listAttributesOfEntityType } from './entityAttributes.js';
import { SponsorSchema } from './sponsor.js';

/** The master sponsor, Mineradora Serra Azul, with its logo. */
function buildMasterSponsor() {
  return {
    sponsorId: 'patrocinador-master',
    name: 'Mineradora Serra Azul',
    tier: 'master',
    rollWeight: 10,
    logoMediaId: '7d1e3a5c9b0f2e4d6c8a1b3f5e7d9c0b2a4f6e8d0c2b4a6f8e0d2c4b6a8f0e2d',
  };
}

/** The first message Zod gives for a value, or undefined when it is accepted. */
function readFirstMessage(result: { success: boolean; error?: { issues: { message: string }[] } }) {
  return result.error?.issues[0]?.message;
}

describe("a sponsor's light plate choice", () => {
  it('accepts a sponsor whose logo goes on the light plate, and one that says nothing', () => {
    // Arrange: the master sponsor marked for the plate, and a support sponsor as a row
    // stored before the choice existed holds it.
    const masterOnThePlate = { ...buildMasterSponsor(), logoOnLightPlate: true };
    const supportStoredBefore = {
      sponsorId: 'apoio-pneus',
      name: 'Pneus Trilha',
      tier: 'apoio',
      rollWeight: 2,
    };

    // Act: check both.
    const resultOnThePlate = SponsorSchema.safeParse(masterOnThePlate);
    const resultSayingNothing = SponsorSchema.safeParse(supportStoredBefore);

    // Assert: both accepted; leaving it out means no plate, so nothing is made up.
    expect(resultOnThePlate.data?.logoOnLightPlate, 'the plate choice must be kept').toBe(true);
    expect(resultSayingNothing.data, 'a sponsor with no choice must be left as it is').toEqual(
      supportStoredBefore,
    );
  });

  it('refuses a plate choice that is not yes or no, naming the field', () => {
    // Arrange: a CSV cell "talvez" passed on as text.
    const sponsorWithAWord = { ...buildMasterSponsor(), logoOnLightPlate: 'talvez' };

    // Act: check it.
    const result = SponsorSchema.safeParse(sponsorWithAWord);

    // Assert: refused with the field's pt-BR sentence.
    expect(readFirstMessage(result), 'the reason must name the field in pt-BR').toBe(
      'Logo sobre placa clara: sim ou não.',
    );
  });

  it('is an attribute of a sponsor an item can read as a yes or no', () => {
    // Arrange: nothing; the attributes are the library's fixed list.

    // Act: find the plate among the sponsor's attributes.
    const plateAttribute = listAttributesOfEntityType('sponsor').find(
      (attribute) => attribute.attributeKey === 'logoOnLightPlate',
    );

    // Assert: a yes or no, optional, read from the record's own field, labelled in pt-BR.
    expect(plateAttribute, 'the sponsor must offer its plate choice to an item').toEqual({
      attributeKey: 'logoOnLightPlate',
      label: 'Logo sobre placa clara',
      valueType: 'boolean',
      recordFieldKey: 'logoOnLightPlate',
      isOptional: true,
    });
  });
});
