/**
 * Importing and exporting a flex config as text (apps/control)
 *
 * What this module is for:
 *   A tested flex config travels as JSON text: "Exportar configuração" writes it to be
 *   copied, and "Importar configuração" reads pasted text, checks it with the shared
 *   HttpJsonConfigSchema and only then fills the form. A preset file (the Baja app's, in
 *   BAJAOVRLAY-18) gets into a source the same way.
 *
 * What these tests prove:
 *   - The example preset's text imports as the config the server would store.
 *   - Text that is not JSON is refused with one pt-BR line.
 *   - A config the schema refuses lists each problem with the place it is at.
 *   - An exported config reads back as the same config.
 *
 * What these tests deliberately do not cover:
 *   - Filling the form from the imported config: flexSourceFormReading.test.ts and
 *     DataSourcesPageFlexImportExport.test.tsx.
 */
import { describe, expect, it } from 'vitest';

import { readImportedFlexConfig, writeExportedFlexConfig } from './flexConfigImportAndExport';
import {
  readExampleTimingSystemConfig,
  readExampleTimingSystemConfigText,
} from './timingSystemExample.testSupport';

describe('readImportedFlexConfig', () => {
  it("imports the example preset's text as the config the server would store", () => {
    // Arrange: the example preset as an operator pastes it.
    const pastedText = readExampleTimingSystemConfigText();

    // Act: read it.
    const configImport = readImportedFlexConfig(pastedText);

    // Assert: the preset, parsed by the shared schema.
    expect(configImport, 'the example preset must import whole').toEqual({
      isImported: true,
      config: readExampleTimingSystemConfig(),
    });
  });

  it('refuses text that is not JSON with one pt-BR line', () => {
    // Arrange: a config copied only halfway.
    const pastedText = readExampleTimingSystemConfigText().slice(0, 120);

    // Act: read it.
    const configImport = readImportedFlexConfig(pastedText);

    // Assert: one line saying it is not JSON.
    expect(configImport, 'broken JSON must be refused, saying so').toEqual({
      isImported: false,
      problems: ['O texto colado não é JSON válido.'],
    });
  });

  it('lists each refusal of the schema with the place it is at', () => {
    // Arrange: the example preset with an ftp:// address and a POST method on its request.
    const config = JSON.parse(readExampleTimingSystemConfigText()) as {
      requests: Record<string, unknown>[];
    };
    config.requests[0] = {
      ...config.requests[0],
      url: 'ftp://cronometragem.local/classificacao',
      method: 'POST',
    };

    // Act: read it.
    const configImport = readImportedFlexConfig(JSON.stringify(config));

    // Assert: both problems, each with its place in the config.
    expect(configImport, 'every problem must be listed with where it is').toEqual({
      isImported: false,
      problems: expect.arrayContaining([
        'requests.0: A requisição tem uma chave que não existe: "method".',
        'requests.0.url: O endereço "ftp://cronometragem.local/classificacao" precisa começar com http:// ou https://.',
      ]),
    });
  });
});

describe('writeExportedFlexConfig', () => {
  it('writes a config that imports back as the same config', () => {
    // Arrange: the example preset as stored.
    const config = readExampleTimingSystemConfig();

    // Act: export it, then import the exported text.
    const exportedText = writeExportedFlexConfig(config);
    const configImport = readImportedFlexConfig(exportedText);

    // Assert: indented to be read, and the same config after the round trip.
    expect(exportedText, 'the export must be indented for a person to read').toContain(
      '\n  "requests": [',
    );
    expect(configImport, 'an exported config must import back unchanged').toEqual({
      isImported: true,
      config,
    });
  });
});
