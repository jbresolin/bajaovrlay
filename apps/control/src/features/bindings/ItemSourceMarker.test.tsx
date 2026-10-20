/**
 * The "fonte" marker of rundown rows and shortcut buttons (apps/control)
 *
 * What this module is for:
 *   A rundown row and a shortcut button of an item that reads a source carry a small
 *   "fonte" marker; when a take would be refused right now (no data yet, a source
 *   deleted…) the marker reads "fonte · não entra agora" and carries the server's reason,
 *   so the operator knows before the press (brief G).
 *
 * What these tests prove:
 *   - A typed item has no marker on its rundown row.
 *   - A bound item whose source has data carries "fonte" on its row and its button.
 *   - A bound item whose source has no data yet carries "fonte · não entra agora", with
 *     the reason as its tooltip.
 *
 * What these tests deliberately do not cover:
 *   - The rule behind the hint, case by case; itemTakeReadiness.test.ts.
 */
import type { Item, Slices } from '@bajaovrlay/shared';
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { QuickFireStrip } from '@/features/quickFire/QuickFireStrip';
import { RundownPanel } from '@/features/rundown/RundownPanel';
import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import {
  buildEnduroSnapshotAtLap34,
  buildSimulatorThatIsOk,
  seededSimulatorId,
} from '@/state/dataSourcesLikeTheServerSends.testSupport';
import {
  buildRaceClockGraphic,
  buildSlicesWithNothingOnAir,
} from '@/state/slicesLikeTheServerSends.testSupport';

/** A race clock item in the home given, its flag bound live to the simulator (or typed). */
function buildClockItem(home: Item['home'], label: string, isFlagBound: boolean): Item {
  return {
    id: `${label}-id`,
    home,
    order: 0,
    graphicId: 'race-clock',
    layerId: 'clock',
    fields: {
      sessionName: { kind: 'literal', value: 'Enduro de Resistência' },
      state: isFlagBound
        ? {
            kind: 'binding',
            sourceId: seededSimulatorId,
            shapeKey: 'session',
            path: 'state',
            isLive: true,
          }
        : { kind: 'literal', value: 'green' },
    },
    label,
    color: 'success',
    notes: '',
  };
}

/** A page with a typed and a bound clock in the rundown, a bound one on "Atalhos". */
function buildSlicesWithBoundItems(hasTheSimulatorData: boolean): Slices {
  return {
    ...buildSlicesWithNothingOnAir(),
    graphics: [buildRaceClockGraphic()],
    items: [
      buildClockItem({ kind: 'rundown', rundownId: 'sessao-principal' }, 'Relógio digitado', false),
      {
        ...buildClockItem(
          { kind: 'rundown', rundownId: 'sessao-principal' },
          'Relógio da fonte',
          true,
        ),
        order: 1,
      },
      buildClockItem({ kind: 'quickFire', panelId: 'atalhos' }, 'Bandeira da fonte', true),
    ],
    dataSources: [buildSimulatorThatIsOk()],
    dataSnapshots: hasTheSimulatorData ? [buildEnduroSnapshotAtLap34(seededSimulatorId)] : [],
  };
}

describe('the "fonte" marker', () => {
  it('marks the bound items on their row and button, and not the typed one', () => {
    // Arrange and act: the rundown and the shortcuts, the simulator with data.
    renderOnControlPageConnectedToFakeServer(
      <>
        <RundownPanel />
        <QuickFireStrip />
      </>,
      buildSlicesWithBoundItems(true),
    );

    // Assert: "fonte" on the bound row and button, nothing on the typed row.
    expect(
      within(screen.getByRole('listitem', { name: /Relógio digitado/ })).queryByText('fonte'),
      'a typed item reads no source',
    ).toBeNull();
    expect(
      within(screen.getByRole('listitem', { name: /Relógio da fonte/ })).getByText('fonte'),
      'the bound row',
    ).toBeVisible();
    expect(
      within(screen.getByRole('listitem', { name: 'Bandeira da fonte' })).getByText('fonte'),
      'the bound button',
    ).toBeVisible();
  });

  it('says a bound item will not go on air now when its source has no data', () => {
    // Arrange and act: the same page, the simulator with no data yet.
    renderOnControlPageConnectedToFakeServer(<RundownPanel />, buildSlicesWithBoundItems(false));

    // Assert: the hint, with the server's reason as its tooltip.
    const hint = within(screen.getByRole('listitem', { name: /Relógio da fonte/ })).getByText(
      'fonte · não entra agora',
    );
    expect(hint, 'the reason must be at hand before the press').toHaveAttribute(
      'title',
      'Bandeira: a fonte Simulador — Enduro ainda não tem dados.',
    );
  });
});
