/**
 * Backspace reads the preview output at the press (apps/control)
 *
 * What this module is for:
 *   Backspace throws away the most recent preview (useBackspaceToStopPreview.ts). Since
 *   BAJAOVRLAY-45 the key reads what is on the outputs at the moment it is pressed instead
 *   of subscribing to it: the subscription redrew the whole console, the item editor in
 *   it, at every live refresh of anything on air.
 *
 * What these tests prove:
 *   - A preview that arrived after the page was drawn is the one Backspace throws away.
 *   - With the only preview gone by the time of the press, Backspace sends nothing.
 *
 * What these tests deliberately do not cover:
 *   - Which preview is the most recent, case by case: src/keyboard/commandForOperatorKey.test.ts.
 *   - Backspace in a field, a dropdown or on the switch: App.test.tsx.
 */
import { fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import { buildRaceClockPreviewOfItem } from '@/state/previewLikeTheServerSends.testSupport';
import { buildSlicesWithNothingOnAir } from '@/state/slicesLikeTheServerSends.testSupport';

import { useBackspaceToStopPreview } from './useBackspaceToStopPreview';

// Saturday 9:58 in Brasília, when the operator previewed the start's clock.
const momentOfThePreview = '2026-10-10T12:58:00.000Z';

/** Stands in for the console: it listens to Backspace as the console does, and draws nothing. */
function PageListeningToBackspace() {
  useBackspaceToStopPreview();
  return null;
}

describe('Backspace with previews that changed after the page was drawn', () => {
  it('throws away a preview that arrived after the page was drawn', () => {
    // Arrange: nothing previewed when the page is drawn; then the start's clock previewed.
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(
      <PageListeningToBackspace />,
      buildSlicesWithNothingOnAir(),
    );
    fakeServer.sendMessage({
      type: 'slice',
      name: 'instances',
      slice: [buildRaceClockPreviewOfItem('item-largada-do-enduro', momentOfThePreview)],
    });

    // Act: press Backspace on the page.
    fireEvent.keyDown(document.body, { key: 'Backspace' });

    // Assert: the preview the server sent last is thrown away.
    expect(
      fakeServer.listCommandsReceived(),
      'Backspace must read the preview output at the moment of the press',
    ).toEqual([{ type: 'stopPreview', layerId: 'clock' }]);
    fakeServer.acceptLastCommand();
  });

  it('sends nothing once the only preview is gone by the time of the press', () => {
    // Arrange: the start's clock previewed when the page is drawn; then the preview gone.
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(<PageListeningToBackspace />, {
      ...buildSlicesWithNothingOnAir(),
      instances: [buildRaceClockPreviewOfItem('item-largada-do-enduro', momentOfThePreview)],
    });
    fakeServer.sendMessage({ type: 'slice', name: 'instances', slice: [] });

    // Act: press Backspace on the page.
    fireEvent.keyDown(document.body, { key: 'Backspace' });

    // Assert: nothing to throw away, so nothing is sent.
    expect(
      fakeServer.listCommandsReceived(),
      'with no preview left, Backspace must send nothing',
    ).toEqual([]);
  });
});
