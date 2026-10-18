/**
 * The line about an instance "Edição rápida" was editing, once it is gone (apps/control)
 *
 * What this module is for:
 *   When the instance loaded into "Edição rápida" leaves its output, is replaced, or the
 *   server stops listing its graphic, the panel lets go of it and says so in one line,
 *   above its hint and "Novo gráfico…". The line says what became of THAT instance, as the
 *   panel first saw it, so the operator is never told something that did not happen.
 *
 * What these tests prove:
 *   - After "saiu do ar", a later take on that layer leaves the words as they were.
 *   - The line goes when the operator moves on: "Novo gráfico…", or "Editar" on a row.
 *   - Decided in BAJAOVRLAY-36: a command sent from elsewhere on the page ("Limpar" on a
 *     "Camadas" row) leaves the line, because only the panel and "Editar" write what it
 *     works on.
 *   - When the server stops listing the edited instance's graphic, the panel lets go of
 *     the instance with its own line (its form comes from that graphic's manifest), and
 *     still has nothing loaded when the graphic is listed again (gate 2 of BAJAOVRLAY-36).
 *
 * What these tests deliberately do not cover:
 *   - How the line first appears, and its words on program and in preview:
 *     QuickEditPanelTarget.test.tsx and quickEditMode.test.ts.
 *   - Where "Novo gráfico…" opens the item editor: QuickEditPanelEmptyState.test.tsx.
 */
import type { Instance } from '@bajaovrlay/shared';
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { buildLowerThirdFixtureGraphic } from '@/state/lowerThirdFixtureGraphic.testSupport';
import { buildRaceClockGraphic } from '@/state/slicesLikeTheServerSends.testSupport';

import {
  buildRaceClockInstanceHoldingThisData,
  pressEditOnTheLayerRow,
  readQuickEditHeader,
  renderQuickEditPanelWithTheseInstancesOnAir,
} from './operatingTheQuickEditPanel.testSupport';

// Saturday of the endurance race: the main clock went on air at 10:00.
const momentTheMainClockWentOnAir = '2026-10-10T13:00:00.000Z';
const idOfTheClockTakenLater = 'a90c2e61-1f4b-4d7e-b3a8-6c5d4e3f2a10';

const lineSayingTheClockLeftTheAir = 'O que você editava na camada Relógio saiu do ar.';

/** The endurance clock on the "Relógio" layer under green, running from 12:34. */
function buildEnduranceClockOnTheClockLayer(): Instance {
  return buildRaceClockInstanceHoldingThisData(
    {
      sessionName: 'Enduro de Resistência',
      state: 'green',
      clockMode: 'elapsed',
      referenceTimeMs: 754_000,
      referenceWallClockMs: Date.parse(momentTheMainClockWentOnAir),
      running: true,
    },
    momentTheMainClockWentOnAir,
  );
}

/**
 * Opens the page with the endurance clock on air, loads it with "Editar" and lets
 * someone clear the clock layer, so the panel shows the line "… saiu do ar".
 */
function openThePanelWithTheEditedClockJustCleared() {
  const page = renderQuickEditPanelWithTheseInstancesOnAir([buildEnduranceClockOnTheClockLayer()]);
  pressEditOnTheLayerRow('Relógio');
  page.fakeServer.sendMessage({ type: 'slice', name: 'instances', slice: [] });
  return page;
}

/** True while the panel shows any line about an instance it was editing. */
function isALineAboutTheLostInstanceShown(): boolean {
  return screen.queryByText(/O que você editava/) !== null;
}

describe('the line about an edited instance that is gone', () => {
  it('keeps saying "saiu do ar" when a take puts another clock on that layer afterwards', () => {
    // Arrange: the edited clock was cleared, and the panel says so.
    const { fakeServer } = openThePanelWithTheEditedClockJustCleared();
    const isTheLineShownAfterTheClear = screen.queryByText(lineSayingTheClockLeftTheAir) !== null;

    // Act: a take from the rundown puts another clock on the clock layer.
    fakeServer.sendMessage({
      type: 'slice',
      name: 'instances',
      slice: [{ ...buildEnduranceClockOnTheClockLayer(), id: idOfTheClockTakenLater }],
    });

    // Assert: the line still says the edited clock left the air; it was never replaced.
    expect(isTheLineShownAfterTheClear, 'the clear must first be reported').toBe(true);
    expect(
      screen.getByText(lineSayingTheClockLeftTheAir),
      'what became of the edited clock must not be rewritten by a later take',
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/foi substituído/),
      'a take made after the clock was gone is not a replacement of it',
    ).toBeNull();
  });

  it('goes away when the operator presses "Novo gráfico…"', () => {
    // Arrange: the edited clock was cleared, and the panel says so.
    openThePanelWithTheEditedClockJustCleared();
    const isTheLineShownAfterTheClear = isALineAboutTheLostInstanceShown();

    // Act: press "Novo gráfico…" (it opens the item editor elsewhere on the page).
    fireEvent.click(screen.getByRole('button', { name: 'Novo gráfico…' }));

    // Assert: the operator has moved on, so the line about the old clock is gone.
    expect(isTheLineShownAfterTheClear, 'the clear must first be reported').toBe(true);
    expect(
      isALineAboutTheLostInstanceShown(),
      'after "Novo gráfico…" the line about the lost clock must be gone',
    ).toBe(false);
  });

  it('goes away when "Editar" loads another instance', () => {
    // Arrange: the edited clock was cleared, and another clock was taken on that layer.
    const { fakeServer } = openThePanelWithTheEditedClockJustCleared();
    fakeServer.sendMessage({
      type: 'slice',
      name: 'instances',
      slice: [{ ...buildEnduranceClockOnTheClockLayer(), id: idOfTheClockTakenLater }],
    });

    // Act: press "Editar" on the clock's row, which loads the clock taken later.
    pressEditOnTheLayerRow('Relógio');

    // Assert: the panel edits that clock, and the line about the old one is gone.
    expect(readQuickEditHeader(), 'the panel must edit the clock loaded now').toBe(
      'Editando: Relógio · Relógio de prova · No ar',
    );
    expect(
      isALineAboutTheLostInstanceShown(),
      'a new "Editar" must take the line about the lost clock away',
    ).toBe(false);
  });

  it('stays when a command is sent from elsewhere on the page', () => {
    // Arrange: the edited clock was cleared, and the panel says so.
    const { fakeServer } = openThePanelWithTheEditedClockJustCleared();

    // Act: "Limpar" on the "Tarja" row of "Camadas"; the server accepts it.
    const lowerThirdRow = within(screen.getByRole('listitem', { name: 'Tarja' }));
    fireEvent.click(lowerThirdRow.getByRole('button', { name: 'Limpar' }));
    fakeServer.acceptLastCommand();

    // Assert: the line is still there, with the same words.
    expect(
      fakeServer.listCommandsReceived(),
      'the only command is the clear of the lower-third layer',
    ).toEqual([{ type: 'clearLayer', layerId: 'lower-third' }]);
    expect(
      screen.getByText(lineSayingTheClockLeftTheAir),
      'only the panel itself and "Editar" may change what the panel says',
    ).toBeInTheDocument();
  });
});

describe("the line when the edited instance's graphic is no longer listed", () => {
  it('lets go of the clock and says why, and still has nothing loaded when the clock is listed again', () => {
    // Arrange: the endurance clock on air and loaded with "Editar".
    const { fakeServer } = renderQuickEditPanelWithTheseInstancesOnAir([
      buildEnduranceClockOnTheClockLayer(),
    ]);
    pressEditOnTheLayerRow('Relógio');

    // Act: the server stops listing the race clock (only the lower third is left), then
    // lists it again.
    fakeServer.sendMessage({
      type: 'slice',
      name: 'graphics',
      slice: [buildLowerThirdFixtureGraphic()],
    });
    const isAHeadingShownWhileTheClockIsNotListed =
      screen.queryByRole('heading', { level: 3 }) !== null;
    const lineWhileTheClockIsNotListed = screen.queryByText(
      'O gráfico do que você editava na camada Relógio não está mais na lista do servidor.',
    );
    fakeServer.sendMessage({
      type: 'slice',
      name: 'graphics',
      slice: [buildRaceClockGraphic(), buildLowerThirdFixtureGraphic()],
    });

    // Assert: nothing loaded, with a line saying why, and still nothing loaded afterwards.
    expect(
      isAHeadingShownWhileTheClockIsNotListed,
      'without its graphic the clock cannot be edited',
    ).toBe(false);
    expect(
      lineWhileTheClockIsNotListed,
      'the panel must say in one line why it let go of the clock',
    ).not.toBeNull();
    expect(
      screen.queryByRole('heading', { level: 3 }),
      'once let go, the clock is not edited again by itself when its graphic comes back',
    ).toBeNull();
  });
});
