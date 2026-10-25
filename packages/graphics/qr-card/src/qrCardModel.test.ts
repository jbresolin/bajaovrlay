/**
 * The QR card's data (packages/graphics/qr-card)
 *
 * What this module is for:
 *   qrCardModel.ts checks the data `load` and `updateAction` receive (the call to action and
 *   the address), says in pt-BR what is wrong with an address the card cannot make into a
 *   code, merges partial updates, and hands back the code's squares for the address.
 *
 * What these tests prove:
 *   - Good data passes and is kept exactly as sent, the address's case included.
 *   - An address is refused, each with its own pt-BR sentence, when it is empty, has a
 *     space or an accent, or is longer than the longest length (106); an address of
 *     exactly 106 characters passes.
 *   - Data with a missing, unknown or mistyped field is refused naming the field.
 *   - An update changes only what it names; a bad one (a new address one character too
 *     long) is refused and leaves the data as it was.
 *   - The squares are those of the address as typed, not as the card writes it in caps.
 *
 * What these tests deliberately do not cover:
 *   - How long an address may be and why; qrCodeEncoding.test.ts derives the 106.
 *   - The manifest's own check of the same rules; qrCardManifestDataAgreement.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { buildLongestSampleAddress, createResultsSample } from './previewData.js';
import {
  findProblemInAddress,
  makeQrCodeModulesOfCard,
  mergePartialUpdateIntoQrCardData,
  parseCompleteQrCardData,
} from './qrCardModel.js';
import { scanQrModules } from './qrCodeScanning.testSupport.js';

describe('parseCompleteQrCardData', () => {
  it('accepts the design’s card and keeps it exactly as sent', () => {
    // Arrange: the results page of the 30ª Competição.
    const data = createResultsSample();

    // Act: check it as load does.
    const check = parseCompleteQrCardData(data);

    // Assert: valid, unchanged.
    expect(check, 'the design’s card must pass unchanged').toEqual({ isValid: true, data });
  });

  const refusedDataScenarios = [
    // A form or a binding that forgot the address.
    {
      name: 'refuses data without the address, naming it',
      data: { callToAction: 'Acompanhe os resultados' },
      problem: 'Falta o campo obrigatório "address".',
    },
    // A typo in a field name must not be ignored.
    {
      name: 'refuses an unknown field, naming it',
      data: { ...createResultsSample(), url: 'resultados.bajasaebrasil.net' },
      problem: 'Campo desconhecido nos dados: "url".',
    },
    // A number bound to the call by mistake.
    {
      name: 'refuses a call to action that is not text',
      data: { ...createResultsSample(), callToAction: 30 },
      problem: 'Valor inválido no campo "callToAction".',
    },
  ];

  it.each(refusedDataScenarios)('$name', ({ data, problem }) => {
    // Arrange: nothing beyond the data of the row.

    // Act: check it as load does.
    const check = parseCompleteQrCardData(data);

    // Assert: refused with the pt-BR sentence.
    expect(check, 'bad data must be refused with its pt-BR problem').toEqual({
      isValid: false,
      problem,
    });
  });
});

const addressScenarios = [
  // Nothing to scan.
  {
    name: 'refuses an empty address',
    address: '',
    problem: 'O endereço do QR está vazio: o código precisa de um endereço para levar o celular.',
  },
  // A space pasted inside the address would send the phone somewhere else.
  {
    name: 'refuses an address with a space',
    address: 'resultados bajasaebrasil.net',
    problem:
      'O endereço do QR só pode ter letras sem acento, números e os sinais de um endereço (sem espaços).',
  },
  // An accent would be cut to one byte by the encoder and scan to the wrong address.
  {
    name: 'refuses an address with an accent',
    address: 'bajasaebrasil.net/competição',
    problem:
      'O endereço do QR só pode ter letras sem acento, números e os sinais de um endereço (sem espaços).',
  },
  // One character past what the largest code holds.
  {
    name: 'refuses an address of 107 characters, saying both lengths',
    address: `${buildLongestSampleAddress()}x`,
    problem: 'O endereço do QR tem 107 caracteres; no cartão cabe um código de no máximo 106.',
  },
  // Exactly at the limit is fine.
  { name: 'accepts an address of exactly 106 characters', address: buildLongestSampleAddress() },
  // Every sign a web address uses is allowed.
  {
    name: 'accepts an address with a scheme, a path, a query and a fragment',
    address: 'https://bajasaebrasil.net/Ao-Vivo?prova=enduro&ano=2026#placar',
  },
];

describe('findProblemInAddress', () => {
  it.each(addressScenarios)('$name', ({ address, problem }) => {
    // Arrange: nothing beyond the address of the row.

    // Act: check the address.
    const foundProblem = findProblemInAddress(address);

    // Assert: the expected sentence, or none.
    expect(foundProblem, 'the address must get exactly its own problem, or none').toBe(problem);
  });

  it('is the problem load answers for a bad address', () => {
    // Arrange: the design's card with an address of 107 characters.
    const data = { ...createResultsSample(), address: `${buildLongestSampleAddress()}x` };

    // Act: check it as load does.
    const check = parseCompleteQrCardData(data);

    // Assert: refused with the address's own sentence, not a generic one.
    expect(check, 'load must say why the address cannot be a code').toEqual({
      isValid: false,
      problem: 'O endereço do QR tem 107 caracteres; no cartão cabe um código de no máximo 106.',
    });
  });
});

describe('mergePartialUpdateIntoQrCardData', () => {
  it('changes only the address when only the address is sent', () => {
    // Arrange: the design's card.
    const currentData = createResultsSample();

    // Act: the operator points the code at the live timing page.
    const check = mergePartialUpdateIntoQrCardData(currentData, {
      address: 'bajasaebrasil.net/ao-vivo',
    });

    // Assert: the new address, the same call to action.
    expect(check, 'an update must change only what it names').toEqual({
      isValid: true,
      data: { callToAction: 'Acompanhe os resultados', address: 'bajasaebrasil.net/ao-vivo' },
    });
  });

  it('refuses an update with an address too long and leaves the data as it was', () => {
    // Arrange: the design's card.
    const currentData = createResultsSample();

    // Act: send an address one character past the limit.
    const check = mergePartialUpdateIntoQrCardData(currentData, {
      address: `${buildLongestSampleAddress()}x`,
    });

    // Assert: refused, and the current data is untouched.
    expect(check.isValid, 'an address too long must be refused on update too').toBe(false);
    expect(currentData, 'a refused update must leave the data as it was').toEqual(
      createResultsSample(),
    );
  });
});

describe('makeQrCodeModulesOfCard', () => {
  it('encodes the address as typed, capitals and all, though the card shows it in caps', () => {
    // Arrange: an address whose path is case-sensitive.
    const data = { callToAction: 'Ao vivo', address: 'https://bajasaebrasil.net/Ao-Vivo' };

    // Act: make the squares and scan them.
    const scannedText = scanQrModules(makeQrCodeModulesOfCard(data));

    // Assert: the code opens exactly what was typed.
    expect(scannedText, 'the code must keep the address’s case').toBe(
      'https://bajasaebrasil.net/Ao-Vivo',
    );
  });
});
