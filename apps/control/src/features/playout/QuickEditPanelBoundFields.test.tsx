/**
 * "Edição rápida" and fields that read a source (apps/control)
 *
 * What this module is for:
 *   An instance taken from a bound item has fields the server keeps up to date from a
 *   source (its entry of `instanceBindings`). Typing over such a field would be
 *   overwritten by the next refresh, so "Edição rápida" shows it read-only, labelled with
 *   where it reads ("Vinculado: Simulador — Enduro › Sessão › Bandeira (ao vivo)"), and
 *   offers the honest way to change it: "Corrigir valor da fonte…", which sends
 *   setOverride. A value a correction changed carries the badge "corrigido".
 *
 * What these tests prove:
 *   - The bound title and flag are read-only, each with its "Vinculado: …" label, while
 *     a typed field stays editable.
 *   - "Corrigir valor da fonte…" on the title sends setOverride for the session name,
 *     with the value and the reason typed.
 *   - A corrected title carries the "corrigido" badge.
 *
 * What these tests deliberately do not cover:
 *   - The dialog's own rules (a blank reason, a value that does not fit);
 *     OverrideDialog.test.tsx.
 */
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LayerStatusPanel } from '@/features/layers/LayerStatusPanel';
import {
  buildSessionNameCorrection,
  buildSlicesWithTheBoundRaceClockOnAir,
} from '@/state/boundInstancesLikeTheServerSends.testSupport';
import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import { seededSimulatorId } from '@/state/dataSourcesLikeTheServerSends.testSupport';

import { pressEditOnTheLayerRow } from './operatingTheQuickEditPanel.testSupport';
import { QuickEditPanel } from './QuickEditPanel';

/** Draws "Edição rápida" and "Camadas" with the bound clock on air, and loads it. */
function loadTheBoundClockIntoQuickEdit(overrides = buildSlicesWithTheBoundRaceClockOnAir({})) {
  const controlPage = renderOnControlPageConnectedToFakeServer(
    <>
      <QuickEditPanel />
      <LayerStatusPanel />
    </>,
    overrides,
  );
  pressEditOnTheLayerRow('Relógio');
  return controlPage;
}

describe('the bound fields of an instance in "Edição rápida"', () => {
  it('shows the title and the flag read-only with where they read, and the time editable', () => {
    // Arrange and act: the bound clock loaded with "Editar".
    loadTheBoundClockIntoQuickEdit();

    // Assert: the two labels, no flag dropdown, and the typed mode still a dropdown.
    expect(
      screen.getByText('Vinculado: Simulador — Enduro › Sessão › Bandeira (ao vivo)'),
      'the flag must say where it reads',
    ).toBeVisible();
    expect(
      screen.getByText('Vinculado: Simulador — Enduro › Sessão › Nome da sessão (ao vivo)'),
      'the title must say where it reads',
    ).toBeVisible();
    expect(
      screen.queryByRole('combobox', { name: 'Bandeira' }),
      'a live field cannot be typed over',
    ).toBeNull();
    expect(
      screen.getByRole('combobox', { name: 'Modo do relógio' }),
      'a typed field stays editable',
    ).toBeVisible();
  });

  it('sends setOverride for the session name from "Corrigir valor da fonte…"', async () => {
    // Arrange: the bound clock loaded.
    const { fakeServer } = loadTheBoundClockIntoQuickEdit();

    // Act: correct the title's source value, with a reason.
    fireEvent.click(screen.getByRole('button', { name: 'Corrigir valor da fonte: Título' }));
    const dialog = within(screen.getByRole('dialog'));
    fireEvent.change(dialog.getByLabelText('Valor corrigido'), {
      target: { value: 'Enduro — Etapa Nacional' },
    });
    fireEvent.change(dialog.getByLabelText('Motivo (obrigatório)'), {
      target: { value: 'Nome oficial da prova.' },
    });
    fireEvent.click(dialog.getByRole('button', { name: 'Salvar correção' }));

    // Assert: one setOverride of the session name, as typed.
    await waitFor(() => {
      expect(fakeServer.listCommandsReceived(), 'the correction must be sent').toEqual([
        {
          type: 'setOverride',
          sourceId: seededSimulatorId,
          scope: 'session',
          field: 'sessionName',
          value: 'Enduro — Etapa Nacional',
          reason: 'Nome oficial da prova.',
        },
      ]);
    });
  });

  it('marks a corrected title with the "corrigido" badge', () => {
    // Arrange and act: the clock loaded while the session name is corrected.
    loadTheBoundClockIntoQuickEdit(
      buildSlicesWithTheBoundRaceClockOnAir({ overrides: [buildSessionNameCorrection()] }),
    );

    // Assert: the badge beside the title, with the reason as its title.
    const badge = screen.getByText('corrigido');
    expect(badge, 'the corrected value must say so').toBeVisible();
    expect(badge, 'the reason must be at hand').toHaveAttribute('title', 'Nome oficial da prova.');
  });
});
