/**
 * The output each monitor shows (apps/control)
 *
 * What this module is for:
 *   Since BAJAOVRLAY-49 a show may have a PiP output beside program, drawn by its own OBS
 *   browser source. "Prévia" and "Programa" each get an output picker: program by
 *   default, and the choice kept in this browser (it is a habit of the person at this
 *   screen, like "Prévia automática", not a fact about the show). The frame then loads
 *   the renderer page of that output (`&output=pip`).
 *
 * What these tests prove:
 *   - With program alone neither monitor offers a picker, and the frames are unchanged.
 *   - With a PiP output both monitors start on program; choosing PiP in "Programa" loads
 *     /render/?monitor=1&output=pip, and in "Prévia" /render/?target=preview&monitor=1&output=pip.
 *   - The choice is kept: a page opened later in this browser starts on it.
 *   - A kept choice of an output that no longer exists falls back to program.
 *   - Before the server's hello brings the outputs, the frame loads nothing, so a browser
 *     that kept "pip" does not load program first and then switch (gate 2).
 *
 * What these tests deliberately do not cover:
 *   - What the renderer draws for each address; apps/renderer.
 */
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  renderOnControlPageConnectedToFakeServer,
  renderOnControlPageStillWaitingForTheServer,
} from '@/state/controlPageOnFakeServer.testSupport';
import { buildSlicesWithThePipOutput } from '@/state/outputsLikeTheServerSends.testSupport';
import { buildSlicesWithNothingOnAir } from '@/state/slicesLikeTheServerSends.testSupport';

import { PreviewAndProgramMonitors } from './PreviewAndProgramMonitors';

afterEach(() => {
  window.localStorage.clear();
});

/** Chooses an output in one monitor's picker, by the names the operator reads. */
function chooseOutputOfMonitor(monitorName: string, outputName: string): void {
  fireEvent.keyDown(screen.getByRole('combobox', { name: `Saída mostrada em ${monitorName}` }), {
    key: 'Enter',
  });
  fireEvent.click(screen.getByRole('option', { name: outputName }));
}

/** The address one monitor's frame loads. */
function readAddressOfMonitor(monitorTitle: string): string | null {
  return screen.getByTitle(monitorTitle).getAttribute('src');
}

describe('the monitors with program alone', () => {
  it('offer no picker and load the same frames as always', () => {
    // Arrange and act: the monitors with program alone.
    renderOnControlPageConnectedToFakeServer(
      <PreviewAndProgramMonitors />,
      buildSlicesWithNothingOnAir(),
    );

    // Assert: no picker; the two plain addresses.
    expect(screen.queryAllByRole('combobox'), 'no picker with one output').toEqual([]);
    expect(readAddressOfMonitor('Programa'), 'program monitor').toBe('/render/?monitor=1');
    expect(readAddressOfMonitor('Prévia'), 'preview monitor').toBe(
      '/render/?target=preview&monitor=1',
    );
  });
});

describe('the monitors with a PiP output', () => {
  it('start on program and load the PiP once it is chosen', () => {
    // Arrange: program and PiP.
    renderOnControlPageConnectedToFakeServer(
      <PreviewAndProgramMonitors />,
      buildSlicesWithThePipOutput(),
    );
    const programAddressAtFirst = readAddressOfMonitor('Programa');

    // Act: choose PiP in both monitors.
    chooseOutputOfMonitor('Programa', 'PiP');
    chooseOutputOfMonitor('Prévia', 'PiP');

    // Assert: program at first, then the PiP's addresses.
    expect(programAddressAtFirst, 'program by default').toBe('/render/?monitor=1');
    expect(readAddressOfMonitor('Programa'), "the PiP's program").toBe(
      '/render/?monitor=1&output=pip',
    );
    expect(readAddressOfMonitor('Prévia'), "the PiP's preview").toBe(
      '/render/?target=preview&monitor=1&output=pip',
    );
  });

  it('keeps the choice for the next page opened in this browser', () => {
    // Arrange: PiP chosen in "Programa", then the page closed.
    renderOnControlPageConnectedToFakeServer(
      <PreviewAndProgramMonitors />,
      buildSlicesWithThePipOutput(),
    );
    chooseOutputOfMonitor('Programa', 'PiP');
    cleanup();

    // Act: open the page again.
    renderOnControlPageConnectedToFakeServer(
      <PreviewAndProgramMonitors />,
      buildSlicesWithThePipOutput(),
    );

    // Assert: "Programa" starts on the PiP; "Prévia" was never changed.
    expect(readAddressOfMonitor('Programa'), 'the choice was kept').toBe(
      '/render/?monitor=1&output=pip',
    );
    expect(readAddressOfMonitor('Prévia'), 'the other monitor kept its own').toBe(
      '/render/?target=preview&monitor=1',
    );
  });

  it('falls back to program when the kept output no longer exists', () => {
    // Arrange: a browser that last showed an output since deleted.
    window.localStorage.setItem('bajaovrlay.saidaDoMonitor.program', 'camera-2');

    // Act: open the page.
    renderOnControlPageConnectedToFakeServer(
      <PreviewAndProgramMonitors />,
      buildSlicesWithThePipOutput(),
    );

    // Assert: program.
    expect(readAddressOfMonitor('Programa'), 'program again').toBe('/render/?monitor=1');
  });

  it('loads nothing before the outputs arrive, then the kept output', () => {
    // Arrange: a browser that last showed the PiP in "Programa", the server not heard yet.
    window.localStorage.setItem('bajaovrlay.saidaDoMonitor.program', 'pip');
    const controlPage = renderOnControlPageStillWaitingForTheServer(<PreviewAndProgramMonitors />);
    const addressBeforeTheHello = readAddressOfMonitor('Programa');

    // Act: the server's hello arrives, with program and PiP.
    act(() => {
      controlPage.fakeServer.sendMessage({ type: 'hello', slices: buildSlicesWithThePipOutput() });
    });

    // Assert: no address before, the PiP's after; program's page was never loaded.
    expect(addressBeforeTheHello, 'nothing is loaded before the outputs are known').toBeNull();
    expect(readAddressOfMonitor('Programa'), 'then the kept output').toBe(
      '/render/?monitor=1&output=pip',
    );
  });
});
