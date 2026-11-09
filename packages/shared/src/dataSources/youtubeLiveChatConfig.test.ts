/**
 * The YouTube live chat source's config (packages/shared)
 *
 * What this module is for:
 *   A YouTube source (BAJAOVRLAY-35) is set up with the live's address only, as the
 *   operator pastes it from YouTube. The server reads the video id from it to find the
 *   live's chat. The API key is never part of the config.
 *
 * What these tests prove:
 *   - The three address forms YouTube gives out are read, with or without "https://",
 *     "www." or "m.", and with the extra parameters YouTube adds ("?si=…", "&t=…").
 *   - A channel's page, another site, a short id and plain text are not addresses.
 *   - The config schema refuses a text that is not an address, with a pt-BR reason, and
 *     keeps no field but the address (no key can be stored in it).
 *
 * What these tests deliberately do not cover:
 *   - Whether the video is live or has a chat; the adapter's tests ask the fake YouTube.
 */
import { describe, expect, it } from 'vitest';

import {
  readYouTubeVideoIdFromAddress,
  YouTubeLiveChatConfigSchema,
} from './youtubeLiveChatConfig.js';

const addressScenarios: Array<{ name: string; address: string; videoId: string | undefined }> = [
  // The address bar of a live on a computer.
  {
    name: 'reads the watch page',
    address: 'https://www.youtube.com/watch?v=BajaLive024',
    videoId: 'BajaLive024',
  },
  // Watch pages often carry a time or a playlist after the id.
  {
    name: 'reads the watch page with more parameters',
    address: 'https://www.youtube.com/watch?v=BajaLive024&t=95s',
    videoId: 'BajaLive024',
  },
  // The v parameter is not always the first one.
  {
    name: 'reads the watch page when v comes second',
    address: 'youtube.com/watch?feature=share&v=BajaLive024',
    videoId: 'BajaLive024',
  },
  // "Compartilhar" gives the short form with a tracking parameter.
  {
    name: 'reads the short link of "Compartilhar"',
    address: 'https://youtu.be/BajaLive024?si=compartilhado',
    videoId: 'BajaLive024',
  },
  // The live's own page, as the channel's "Ao vivo" tab links it.
  {
    name: 'reads the live page',
    address: 'https://www.youtube.com/live/BajaLive024?feature=shared',
    videoId: 'BajaLive024',
  },
  // Pasted from a phone: the mobile host and no protocol.
  {
    name: 'reads the mobile site without a protocol',
    address: '  m.youtube.com/watch?v=BajaLive024  ',
    videoId: 'BajaLive024',
  },
  // A channel is not a live: the source would not know which chat to read.
  {
    name: 'refuses a channel page',
    address: 'https://www.youtube.com/@BajaSAEBrasil',
    videoId: undefined,
  },
  // Another site with a v parameter is not YouTube.
  {
    name: 'refuses another site',
    address: 'https://vimeo.com/watch?v=BajaLive024',
    videoId: undefined,
  },
  // A video id has eleven characters; a cut paste must not reach YouTube.
  { name: 'refuses a short id', address: 'https://youtu.be/BajaLive', videoId: undefined },
  // Plain text typed in the field by mistake.
  { name: 'refuses plain text', address: 'transmissão de sábado', videoId: undefined },
];

describe('reading the video id of a live address', () => {
  it.each(addressScenarios)('$name', ({ address, videoId }) => {
    // Arrange: the address as pasted (in the table).

    // Act: read the video id from it.
    const readVideoId = readYouTubeVideoIdFromAddress(address);

    // Assert: the id of the live, or nothing when it is not a live's address.
    expect(readVideoId, `the video id read from "${address}"`).toBe(videoId);
  });
});

describe('the config schema', () => {
  it('refuses a text that is not a live address, in pt-BR', () => {
    // Arrange: a channel's page pasted instead of the live's.
    const config = { liveAddress: 'https://www.youtube.com/@BajaSAEBrasil' };

    // Act: check it.
    const result = YouTubeLiveChatConfigSchema.safeParse(config);

    // Assert: refused at the address, with the pt-BR reason listing the forms.
    expect(result.success, 'a channel page must be refused').toBe(false);
    expect(result.error?.issues[0]?.path, 'the refusal must point at the address').toEqual([
      'liveAddress',
    ]);
    expect(result.error?.issues[0]?.message, 'the reason must name the three forms').toContain(
      'youtu.be/',
    );
  });

  it('keeps the address and drops anything else, such as a key', () => {
    // Arrange: a config with an API key written beside the address.
    const config = {
      liveAddress: 'https://youtu.be/BajaLive024',
      apiKey: 'youtube-test-api-key-0001',
    };

    // Act: parse it.
    const parsed = YouTubeLiveChatConfigSchema.parse(config);

    // Assert: only the address is kept, so no key can be stored in a slice.
    expect(parsed, 'the config must hold the address only').toEqual({
      liveAddress: 'https://youtu.be/BajaLive024',
    });
  });
});
