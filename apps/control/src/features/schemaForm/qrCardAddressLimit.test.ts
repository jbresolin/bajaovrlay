/**
 * The item editor refuses a QR address too long for the code's box (apps/control)
 *
 * What this module is for:
 *   The QR card draws its code from the address in a 176 px box, and an address past the
 *   encoder's capacity there (version 6 at level M: 106 characters) would make the cells
 *   too small to scan off a phone. The QR card's manifest says so with `maxLength` on the
 *   address (BAJAOVRLAY-47), and the item editor's generated form applies a manifest's
 *   `maxLength` to any graphic. These tests read the real QR card manifest, so a change of
 *   its limit is seen here.
 *
 * What these tests prove:
 *   - An address of exactly 106 characters passes the form's check.
 *   - One of 107 is refused, with the pt-BR message naming the field and the limit.
 *
 * What these tests deliberately do not cover:
 *   - That 106 is the encoder's capacity, and that such a code scans: the QR card's own
 *     tests (qrCodeEncoding.test.ts and the e2e scan).
 *   - The browser stopping the typing at the limit (the input's maxlength attribute):
 *     SchemaFormFields.test.tsx covers that for any field with maxLength.
 */
import qrCardManifest from '@bajaovrlay/qr-card/qr-card.ograf.json';
import { describe, expect, it } from 'vitest';

import { buildEmptySchemaFormValues } from './buildSchemaFormValues';
import { checkSchemaFormValues } from './checkSchemaFormValues';
import { describeSchemaFormFromDataSchema } from './describeSchemaFormFromDataSchema';

/** An address of the given length, as an event would type one: the results page, padded. */
function buildResultsAddressOfLength(length: number): string {
  const start = 'resultados.bajasaebrasil.net/2026/nacional/';
  return start + 'a'.repeat(length - start.length);
}

/** The QR card's form with the call to action typed and the address given. */
function buildQrCardFormWithAddress(address: string) {
  const description = describeSchemaFormFromDataSchema(qrCardManifest.schema);
  const formValues = buildEmptySchemaFormValues(description);
  return {
    description,
    formValues: {
      ...formValues,
      values: { ...formValues.values, callToAction: 'Acompanhe os resultados', address },
    },
  };
}

describe('the QR card’s address in the item editor', () => {
  it('accepts an address of exactly 106 characters', () => {
    // Arrange: the form with the longest address the code's box holds.
    const { description, formValues } = buildQrCardFormWithAddress(
      buildResultsAddressOfLength(106),
    );

    // Act: check the form, as "Salvar item" does.
    const check = checkSchemaFormValues(description, formValues);

    // Assert: nothing to refuse.
    expect(check.status, 'an address at the limit must pass').toBe('valid');
  });

  it('refuses an address of 107 characters, naming the field and the limit', () => {
    // Arrange: the form with one character more than the code's box holds.
    const { description, formValues } = buildQrCardFormWithAddress(
      buildResultsAddressOfLength(107),
    );

    // Act: check the form.
    const check = checkSchemaFormValues(description, formValues);

    // Assert: refused on the address, in pt-BR.
    expect(check, 'an address past the limit must be refused before it is sent').toEqual({
      status: 'invalid',
      fieldMessages: [
        {
          fieldKey: 'address',
          message: 'O campo "Endereço do QR" pode ter no máximo 106 caracteres.',
        },
      ],
    });
  });
});
