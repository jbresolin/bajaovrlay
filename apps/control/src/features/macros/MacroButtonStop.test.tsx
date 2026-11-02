/**
 * A macro button after its run stopped short (apps/control)
 *
 * What this module is for:
 *   When a step of a macro is refused (OBS down, a scene OBS no longer has, an item
 *   deleted), the server's runner stops the macro there and nothing after it runs. The
 *   server keeps which step and why in the `macroStops` slice (BAJAOVRLAY-27), and the
 *   macro's button shows it until the macro runs again, so the operator knows the
 *   graphics after that step did not go on air.
 *
 * What these tests prove:
 *   - A macro that stopped short says "Parou no passo 1" on its button, with the reason
 *     in full for a screen reader and on hover.
 *   - Another macro's button says nothing of it.
 *   - While the macro runs again its running badge is shown, not the old stop.
 *
 * What these tests deliberately do not cover:
 *   - Why the runner stops: the server's obsSceneMacroStep.test.ts and macroRunner tests.
 *   - When the server drops a stop (a new run, a delete): storeMacroStops.test.ts.
 */
import type { MacroStop } from '@bajaovrlay/shared';
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import {
  buildOpenTheSessionRunningAtTheWait,
  buildSlicesWithShortcutsAndMacros,
  openTheSessionMacroId,
} from '@/state/quickFireLikeTheServerSends.testSupport';

import { MacroGrid } from './MacroGrid';

/** "Abrir a sessão" stopped at its first step because OBS was not connected. */
function buildOpenTheSessionStoppedWithObsDown(): MacroStop {
  return {
    macroId: openTheSessionMacroId,
    stepIndex: 0,
    reason: 'O OBS não está conectado. Veja o motivo passando o mouse sobre "OBS" no topo.',
    stoppedAt: '2026-11-14T13:15:00.000Z',
  };
}

/** The list of macro buttons. */
function findMacroList() {
  return within(screen.getByRole('list', { name: 'Macros' }));
}

describe('a macro button after its run stopped short', () => {
  it('says where it stopped, with the reason for a screen reader and on hover', () => {
    // Arrange: "Abrir a sessão" stopped at its first step with OBS down.
    const slices = buildSlicesWithShortcutsAndMacros();
    slices.macroStops = [buildOpenTheSessionStoppedWithObsDown()];

    // Act: draw the grid.
    renderOnControlPageConnectedToFakeServer(<MacroGrid />, slices);

    // Assert: the button says where, and carries the reason.
    const stoppedButton = findMacroList().getByRole('button', { name: /^Abrir a sessão/ });
    const stopBadge = within(stoppedButton).getByText('Parou no passo 1');
    expect(
      stopBadge,
      'the step must be counted from 1, as on the badge while running',
    ).toBeVisible();
    expect(
      stoppedButton,
      'the reason must be in the button’s description',
    ).toHaveAccessibleDescription(
      'Parou no passo 1: O OBS não está conectado. Veja o motivo passando o mouse sobre "OBS" no topo.',
    );
    expect(stopBadge, 'the reason must show on hover').toHaveAttribute(
      'title',
      'O OBS não está conectado. Veja o motivo passando o mouse sobre "OBS" no topo.',
    );
  });

  it('says nothing on another macro’s button', () => {
    // Arrange: only "Abrir a sessão" stopped short.
    const slices = buildSlicesWithShortcutsAndMacros();
    slices.macroStops = [buildOpenTheSessionStoppedWithObsDown()];

    // Act: draw the grid.
    renderOnControlPageConnectedToFakeServer(<MacroGrid />, slices);

    // Assert: "Fechar a sessão" has no stop.
    expect(
      findMacroList().getByRole('button', { name: /^Fechar a sessão/ }),
      'a macro that did not stop short must not say so',
    ).not.toHaveTextContent('Parou');
  });

  it('shows the running badge, not the old stop, while the macro runs again', () => {
    // Arrange: the stop still listed in the very moment the new run appears.
    const slices = buildSlicesWithShortcutsAndMacros();
    slices.macroStops = [buildOpenTheSessionStoppedWithObsDown()];
    slices.macroRuns = [buildOpenTheSessionRunningAtTheWait('2026-11-14T13:16:00.000Z')];

    // Act: draw the grid.
    renderOnControlPageConnectedToFakeServer(<MacroGrid />, slices);

    // Assert: running, and no stop.
    const runningButton = findMacroList().getByRole('button', { name: /^Abrir a sessão/ });
    expect(runningButton, 'a running macro shows its run').toHaveTextContent('Rodando');
    expect(runningButton, 'a running macro does not show its old stop').not.toHaveTextContent(
      'Parou',
    );
  });
});
