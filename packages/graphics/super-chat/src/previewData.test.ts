/**
 * Data for the preview page (packages/graphics/super-chat)
 *
 * What this module is for:
 *   preview.html shows the Super Chat card on its own, for designers and for the
 *   screenshot tests. It takes its data from `?data=<JSON>` in the address, or shows the
 *   short message sample when there is none; its buttons send the short message sample or
 *   the sample with no message.
 *
 * What these tests prove:
 *   - Without `?data=`, the preview shows Torcida Pequi Off-Road's R$ 20,00 from Goiânia,
 *     the same fictional viewer the server's sample event uses.
 *   - The sample with no message is Ana do Paddock's R$ 5,00, with an empty message.
 *   - With `?data=`, the JSON in the address is used exactly as written.
 *   - JSON that cannot be read gives a pt-BR problem to show, not an exception.
 *
 * What these tests deliberately do not cover:
 *   - Whether the data is valid; the graphic's own `load` decides that (super-chat.test.ts).
 */
import { describe, expect, it } from 'vitest';

import { choosePreviewData, createEmptyMessageSample } from './previewData.js';

describe('choosePreviewData', () => {
  it('uses the short message sample when the address has no data', () => {
    // Arrange: the address of the preview page with no query at all.
    const addressQuery = '';

    // Act: choose the data to show.
    const choice = choosePreviewData(addressQuery);

    // Assert: the short message sample.
    expect(choice, 'with no ?data= the preview must show the short message sample').toEqual({
      isReadable: true,
      data: {
        amountText: 'R$ 20,00',
        authorName: 'Torcida Pequi Off-Road',
        messageText: 'Vai, Pequi! Abraço de Goiânia',
      },
    });
  });

  it('uses the JSON from ?data= exactly as written', () => {
    // Arrange: a R$ 100,00 Super Chat encoded into the address as the tests do.
    const superChatData = { amountText: 'R$ 100,00', authorName: 'Família Carnaúba' };
    const addressQuery = `?data=${encodeURIComponent(JSON.stringify(superChatData))}`;

    // Act: choose the data to show.
    const choice = choosePreviewData(addressQuery);

    // Assert: the data is the address JSON, untouched.
    expect(choice, 'the ?data= JSON must be used exactly as written').toEqual({
      isReadable: true,
      data: superChatData,
    });
  });

  it('gives a pt-BR problem instead of throwing when ?data= is not JSON', () => {
    // Arrange: an address whose data was cut off while being copied.
    const addressQuery = '?data=%7B%22amountText%22%3A%22R';

    // Act: choose the data to show.
    const choice = choosePreviewData(addressQuery);

    // Assert: a pt-BR problem the page can show.
    expect(choice, 'unreadable ?data= must produce a pt-BR problem').toEqual({
      isReadable: false,
      problem: 'O parâmetro ?data= do endereço não é um JSON válido.',
    });
  });
});

describe('createEmptyMessageSample', () => {
  it('is a viewer who paid R$ 5,00 and wrote nothing', () => {
    // Arrange: nothing to set up; the sample is built fresh.

    // Act: build the sample the "Sem mensagem" button sends.
    const emptyMessageSample = createEmptyMessageSample();

    // Assert: the amount, the author and an empty message.
    expect(emptyMessageSample, 'the sample must have an empty message').toEqual({
      amountText: 'R$ 5,00',
      authorName: 'Ana do Paddock',
      messageText: '',
    });
  });
});
