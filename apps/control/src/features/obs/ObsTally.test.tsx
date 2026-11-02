/**
 * The OBS tally in the header (apps/control)
 *
 * What this module is for:
 *   The control page always shows, in the header, whether the server is connected to OBS
 *   and which scene is on OBS's Program (and on its Preview, in Studio Mode), read from the
 *   `obs` slice (BAJAOVRLAY-27). Hovering it shows where the server connects and the last
 *   error. It is small and read-only: switching scenes is a macro's or a pad's job.
 *
 * What these tests prove, one row per connection state and Studio Mode:
 *   - no address: "OBS não configurado", and the hover says which variable to set;
 *   - connecting: "Conectando…", and the hover names the address;
 *   - connected, Studio Mode off: "Programa: Pista" and no Preview;
 *   - connected, Studio Mode on: "Programa: Pista" and "Prévia: Pódio";
 *   - error: "Sem conexão", and the hover names the address and the last error;
 *   - connected again after an error: the scene, and the hover keeps the last error.
 *   And the dot carries the state, and the tally holds nothing to press.
 *
 * What these tests deliberately do not cover:
 *   - Where the slice comes from: the server's obsConnection.test.ts.
 *   - The dot's colours; styling is checked by eye in the browser.
 */
import { type ObsSlice, obsSliceWithoutObs } from '@bajaovrlay/shared';
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import { buildSlicesWithNothingOnAir } from '@/state/slicesLikeTheServerSends.testSupport';

import { ObsTally } from './ObsTally';

const addressOfTheStreamPcObs = 'ws://host.docker.internal:4455';
const droppedConnectionReason = 'A conexão com o OBS caiu. O servidor tenta de novo a cada 5 s.';

/** OBS as the server holds it when connected with "Pista" on Program. */
function buildObsConnectedOnTheTrack(): ObsSlice {
  return {
    connectionState: 'conectado',
    address: addressOfTheStreamPcObs,
    lastError: null,
    sceneNames: ['Pista', 'Box', 'Pódio', 'Intervalo'],
    programSceneName: 'Pista',
    isStudioModeOn: false,
    previewSceneName: null,
    sceneSwitch: null,
  };
}

const tallyScenarios = [
  // BAJAOVRLAY_OBS_URL not set: the page must say so rather than look broken.
  {
    name: 'no address: "OBS não configurado", the hover naming the variable',
    obs: obsSliceWithoutObs,
    expectedText: 'OBS não configurado',
    expectedHover: 'Defina BAJAOVRLAY_OBS_URL no servidor para ligar o controle do OBS.',
    expectedState: 'desligado',
  },
  // The first attempt since the boot.
  {
    name: 'connecting: "Conectando…", the hover naming the address',
    obs: { ...obsSliceWithoutObs, connectionState: 'conectando', address: addressOfTheStreamPcObs },
    expectedText: 'OBS Conectando…',
    expectedHover: `Endereço: ${addressOfTheStreamPcObs}`,
    expectedState: 'conectando',
  },
  // Race day, no Studio Mode: Program only.
  {
    name: 'connected, Studio Mode off: Program and no Preview',
    obs: buildObsConnectedOnTheTrack(),
    expectedText: 'OBS Programa: Pista',
    expectedHover: `Endereço: ${addressOfTheStreamPcObs}`,
    expectedState: 'conectado',
  },
  // Studio Mode: the scene lined up on Preview shows too.
  {
    name: 'connected, Studio Mode on: Program and Preview',
    obs: { ...buildObsConnectedOnTheTrack(), isStudioModeOn: true, previewSceneName: 'Pódio' },
    expectedText: 'OBS Programa: Pista Prévia: Pódio',
    expectedHover: `Endereço: ${addressOfTheStreamPcObs}`,
    expectedState: 'conectado',
  },
  // OBS closed: no scene may be shown as live.
  {
    name: 'error: "Sem conexão", the hover naming the address and the last error',
    obs: {
      ...obsSliceWithoutObs,
      connectionState: 'erro',
      address: addressOfTheStreamPcObs,
      lastError: droppedConnectionReason,
    },
    expectedText: 'OBS Sem conexão',
    expectedHover: `Endereço: ${addressOfTheStreamPcObs}\nÚltimo erro: ${droppedConnectionReason}`,
    expectedState: 'erro',
  },
  // Back after a drop: the scene again, and the hover still says what happened.
  {
    name: 'connected again after an error: the scene, the hover keeping the last error',
    obs: { ...buildObsConnectedOnTheTrack(), lastError: droppedConnectionReason },
    expectedText: 'OBS Programa: Pista',
    expectedHover: `Endereço: ${addressOfTheStreamPcObs}\nÚltimo erro: ${droppedConnectionReason}`,
    expectedState: 'conectado',
  },
] satisfies Array<{
  name: string;
  obs: ObsSlice;
  expectedText: string;
  expectedHover: string;
  expectedState: ObsSlice['connectionState'];
}>;

describe('the OBS tally', () => {
  it.each(tallyScenarios)('$name', ({ obs, expectedText, expectedHover, expectedState }) => {
    // Arrange: the server's slices with this row's OBS (in the table above).
    const slices = { ...buildSlicesWithNothingOnAir(), obs };

    // Act: draw the tally on a connected page.
    renderOnControlPageConnectedToFakeServer(<ObsTally />, slices);

    // Assert: the words, the hover and the dot's state, and nothing to press.
    const tally = screen.getByRole('status', { name: 'OBS' });
    expect(tally.textContent, 'the tally must say exactly what OBS is doing').toBe(expectedText);
    expect(tally, 'the hover must name the address and the last error').toHaveAttribute(
      'title',
      expectedHover,
    );
    expect(
      within(tally).getByTestId('obs-connection-dot'),
      'the dot must carry the connection state',
    ).toHaveAttribute('data-connection-state', expectedState);
    expect(within(tally).queryAllByRole('button'), 'the tally must be read-only').toEqual([]);
  });
});
