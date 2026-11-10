/**
 * Reading the YouTube live chat source form (control page)
 *
 * What this module is for:
 *   "+ Fonte" → "Chat do YouTube (Super Chats)" (BAJAOVRLAY-35) asks for a name, the live's
 *   address as pasted from YouTube, and how often to read the chat. Every reading spends
 *   5 units of the server's daily YouTube quota, so the interval starts at 30 s and may not
 *   go under 10 s. This module turns the form's text into a source ready to send, or a
 *   pt-BR message under each wrong field.
 *
 * What these tests prove:
 *   - A new form starts at 30 s, with no name and no address.
 *   - A stored source fills the form back with its address and interval.
 *   - A pasted "Compartilhar" link is read into a config holding the address only.
 *   - A channel page instead of a live is refused under the address, in pt-BR.
 *   - Under 10 s and over 60 s are refused under the interval; 10 s itself is accepted.
 *
 * What these tests deliberately do not cover:
 *   - Which address forms are read; the shared youtubeLiveChatConfig.test.ts covers them.
 *   - The form on the page; DataSourcesPageYouTube.test.tsx draws it.
 */
import type { YouTubeLiveChatDataSource } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import {
  buildYouTubeLiveChatSourceFormValues,
  readYouTubeLiveChatSourceForm,
  type YouTubeLiveChatSourceFormValues,
} from './youtubeLiveChatSourceForm';

/** The chat of Saturday's enduro live, read every 20 s. */
function buildEnduroLiveChatSource(): YouTubeLiveChatDataSource {
  return {
    id: 'youtube-enduro-sabado',
    kind: 'youtubeLiveChat',
    label: 'Chat do enduro',
    pollIntervalMs: 20_000,
    isEnabled: false,
    isRecording: false,
    config: { liveAddress: 'https://www.youtube.com/watch?v=BajaLive024' },
    status: {
      lastError: null,
      consecutiveFailures: 0,
      isStale: false,
      staleAfterMs: 60_000,
      recordingError: null,
    },
  };
}

/** The form as the operator fills it for Saturday's live, before any mistake. */
function buildFilledForm(): YouTubeLiveChatSourceFormValues {
  return {
    label: 'Chat do enduro',
    pollIntervalSeconds: '30',
    liveAddress: 'https://youtu.be/BajaLive024?si=compartilhado',
  };
}

describe('the values a YouTube form opens with', () => {
  it('starts a new source at 30 s, with no name and no address', () => {
    // Arrange: no stored source ("+ Fonte").

    // Act: build the form's values.
    const values = buildYouTubeLiveChatSourceFormValues(null);

    // Assert: 30 s, everything else empty.
    expect(values, 'a new YouTube source must start at 30 s').toEqual({
      label: '',
      pollIntervalSeconds: '30',
      liveAddress: '',
    });
  });

  it('fills the form back from a stored source', () => {
    // Arrange: the stored enduro chat, read every 20 s.
    const source = buildEnduroLiveChatSource();

    // Act: build the form's values ("Editar").
    const values = buildYouTubeLiveChatSourceFormValues(source);

    // Assert: its name, interval and address.
    expect(values, 'the form must show the stored source').toEqual({
      label: 'Chat do enduro',
      pollIntervalSeconds: '20',
      liveAddress: 'https://www.youtube.com/watch?v=BajaLive024',
    });
  });
});

describe('reading a YouTube form', () => {
  it('reads a pasted "Compartilhar" link into a config holding the address only', () => {
    // Arrange: the form filled with the short link.
    const values = buildFilledForm();

    // Act: read it.
    const reading = readYouTubeLiveChatSourceForm(values);

    // Assert: a source ready to send, 30 s, the address as pasted.
    expect(reading, 'a filled form must be ready to send').toEqual({
      isValid: true,
      label: 'Chat do enduro',
      pollIntervalMs: 30_000,
      config: { liveAddress: 'https://youtu.be/BajaLive024?si=compartilhado' },
    });
  });

  it('refuses a channel page under the address, in pt-BR', () => {
    // Arrange: the channel's page pasted instead of the live's.
    const values = { ...buildFilledForm(), liveAddress: 'https://www.youtube.com/@BajaSAEBrasil' };

    // Act: read it.
    const reading = readYouTubeLiveChatSourceForm(values);

    // Assert: refused, the message under the address naming the forms YouTube gives.
    expect(reading.isValid, 'a channel page must be refused').toBe(false);
    expect(
      reading.isValid ? undefined : reading.errorMessageByField.liveAddress,
      'the message must say which addresses are read',
    ).toBe(
      'Cole o endereço da transmissão: youtube.com/watch?v=…, youtu.be/… ou youtube.com/live/….',
    );
  });

  const intervalScenarios = [
    // 5 s would spend the day's quota in under seven hours.
    { name: 'refuses 5 s', pollIntervalSeconds: '5', isAccepted: false },
    // 10 s is the floor, accepted.
    { name: 'accepts 10 s, the floor', pollIntervalSeconds: '10', isAccepted: true },
    // Slower than once a minute is not live any more, as for every source.
    { name: 'refuses 90 s', pollIntervalSeconds: '90', isAccepted: false },
  ];

  it.each(intervalScenarios)('$name', ({ pollIntervalSeconds, isAccepted }) => {
    // Arrange: the filled form with this interval.
    const values = { ...buildFilledForm(), pollIntervalSeconds };

    // Act: read it.
    const reading = readYouTubeLiveChatSourceForm(values);

    // Assert: accepted, or refused under the interval with the YouTube message.
    expect(reading.isValid, `an interval of ${pollIntervalSeconds} s: accepted or not`).toBe(
      isAccepted,
    );
    if (!isAccepted) {
      expect(
        reading.isValid ? undefined : reading.errorMessageByField.pollIntervalSeconds,
        'the message must say why YouTube needs a slower interval',
      ).toBe('Informe de 10 a 60 segundos: cada leitura gasta cota do YouTube.');
    }
  });
});
