/**
 * "+ Evento" picks a team of Cadastros, or none (apps/control)
 *
 * What this module is for:
 *   Typing the car, team and school of a typed event by hand is slow and lets a typo reach
 *   the air (BAJAOVRLAY-67). The form now starts with "Equipe dos cadastros": a search box
 *   over the teams of Cadastros (by car number, team or school, as the item editor's
 *   "Cadastro" picker searches) and a list reading "47 · Carnaúba Baja · UFERSA", in car
 *   number order. A pick fills the car, team and school, which stay editable; changing one
 *   by hand keeps the others and clears the pick, so the form never claims a team it no
 *   longer matches. A car number typed by hand fills a blank team and school from the team
 *   of that number, never what the operator typed. The list also offers "Sem equipe (aviso
 *   geral)": a notice about the event itself, with no car, team or school.
 *
 * What these tests prove:
 *   - A pick fills all three, and they are sent.
 *   - The search finds a team by its number, its name (accents or not) and its school.
 *   - Changing a field after a pick clears the pick and keeps the other two.
 *   - A typed car number fills a blank team and school, replaces what an earlier number
 *     filled, and never what the operator typed.
 *   - With no team in Cadastros a line says so, and the form works as before.
 *   - "Sem equipe (aviso geral)" hides the car, team and school and sends a notice with
 *     none; as a penalty it is refused on the page, saying a penalty needs a car.
 *
 * What these tests deliberately do not cover:
 *   - The form without the picker (kind, reason, penalty); ManualEventDialog.test.tsx.
 *   - The server's own fallback to Cadastros; manualEventTeamAndSchoolOnTheStore.test.ts.
 */
import type { Team } from '@bajaovrlay/shared';
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { chooseOptionInDropdown } from '@/features/schemaForm/schemaFormOnTestPage.testSupport';
import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import {
  buildSlicesWithTheInbox,
  buildTeamsOfCadastros,
} from '@/state/eventsLikeTheServerSends.testSupport';

import { EventReviewPage } from './EventReviewPage';

/** The "Eventos" page with the teams given in Cadastros, and "+ Evento" pressed. */
function openTheManualEventFormWithTeams(teams: Team[]) {
  const controlPage = renderOnControlPageConnectedToFakeServer(
    <EventReviewPage />,
    buildSlicesWithTheInbox([], teams),
  );
  fireEvent.click(screen.getByRole('button', { name: '+ Evento' }));
  return controlPage;
}

/** Types a text into the form's field of this label. */
function typeInto(fieldLabel: string, text: string): void {
  fireEvent.change(screen.getByLabelText(fieldLabel), { target: { value: text } });
}

/** What the car, team and school inputs hold now. */
function readCarTeamAndSchool(): [string, string, string] {
  return [
    (screen.getByLabelText('Carro') as HTMLInputElement).value,
    (screen.getByLabelText('Equipe') as HTMLInputElement).value,
    (screen.getByLabelText('Escola') as HTMLInputElement).value,
  ];
}

/** The options the team list offers, as the operator reads them. */
function readTeamOptions(): string[] {
  fireEvent.keyDown(screen.getByRole('combobox', { name: 'Equipe dos cadastros' }), {
    key: 'Enter',
  });
  const optionNames = screen.getAllByRole('option').map((option) => option.textContent ?? '');
  fireEvent.keyDown(screen.getAllByRole('option')[0] ?? document.body, { key: 'Escape' });
  return optionNames;
}

describe('picking a team of Cadastros', () => {
  it('fills the car, team and school, and sends them', () => {
    // Arrange: the form, with three teams in Cadastros.
    const { fakeServer } = openTheManualEventFormWithTeams(buildTeamsOfCadastros());

    // Act: pick car 47 and type the reason, then create the event.
    chooseOptionInDropdown('Equipe dos cadastros', '47 · Carnaúba Baja · UFERSA');
    const filledByThePick = readCarTeamAndSchool();
    typeInto('Motivo', 'Queima de largada');
    fireEvent.click(screen.getByRole('button', { name: 'Criar evento' }));

    // Assert: the three fields filled, and sent as they read.
    expect(filledByThePick, 'the pick fills car, team and school').toEqual([
      '47',
      'Carnaúba Baja',
      'UFERSA',
    ]);
    expect(fakeServer.listCommandsReceived(), 'the picked team must be sent').toEqual([
      {
        type: 'createManualEvent',
        noticeKind: 'penalty',
        carNumber: 47,
        teamName: 'Carnaúba Baja',
        schoolName: 'UFERSA',
        reason: 'Queima de largada',
      },
    ]);
  });

  it('lists the teams by car number, after "Sem equipe (aviso geral)"', () => {
    // Arrange: the form, Cadastros holding 47, 12 and 31 in that order.
    openTheManualEventFormWithTeams(buildTeamsOfCadastros());

    // Act: open the list with nothing searched.
    const options = readTeamOptions();

    // Assert: the general notice first, then the cars in number order.
    expect(options, 'the list reads car · team · school, by car number').toEqual([
      'Sem equipe (aviso geral)',
      '12 · Gralha Azul Baja · UTFPR',
      '31 · Acauã Baja · Mauá',
      '47 · Carnaúba Baja · UFERSA',
    ]);
  });

  const searchScenarios = [
    // The commentator says the number on the radio.
    { name: 'finds a team by its car number', search: '47', found: '47 · Carnaúba Baja · UFERSA' },
    // An operator types fast and without accents.
    {
      name: 'finds a team by its name, without accents',
      search: 'acaua',
      found: '31 · Acauã Baja · Mauá',
    },
    // Sometimes only the school is known.
    { name: 'finds a team by its school', search: 'UTFPR', found: '12 · Gralha Azul Baja · UTFPR' },
  ];

  it.each(searchScenarios)('$name', ({ search, found }) => {
    // Arrange: the form, with three teams in Cadastros.
    openTheManualEventFormWithTeams(buildTeamsOfCadastros());

    // Act: search.
    typeInto('Buscar equipe', search);

    // Assert: that team alone, after the general notice.
    expect(readTeamOptions(), 'the search must find this team only').toEqual([
      'Sem equipe (aviso geral)',
      found,
    ]);
  });

  it('clears the pick and keeps the other fields when one is changed by hand', () => {
    // Arrange: car 47 picked.
    openTheManualEventFormWithTeams(buildTeamsOfCadastros());
    chooseOptionInDropdown('Equipe dos cadastros', '47 · Carnaúba Baja · UFERSA');

    // Act: the operator corrects the school.
    typeInto('Escola', 'UFERSA Mossoró');

    // Assert: the pick is gone; car and team stay as the pick left them.
    expect(
      screen.getByRole('combobox', { name: 'Equipe dos cadastros' }).textContent,
      'the form no longer claims team 47',
    ).toBe('Escolha uma equipe');
    expect(readCarTeamAndSchool(), 'the other two stay').toEqual([
      '47',
      'Carnaúba Baja',
      'UFERSA Mossoró',
    ]);
  });
});

describe('a car number typed by hand', () => {
  it('fills a blank team and school from the team of that number', () => {
    // Arrange: the form, with three teams in Cadastros.
    openTheManualEventFormWithTeams(buildTeamsOfCadastros());

    // Act: type car 12.
    typeInto('Carro', '12');

    // Assert: its team and school filled in.
    expect(readCarTeamAndSchool(), 'car 12 brings its team and school').toEqual([
      '12',
      'Gralha Azul Baja',
      'UTFPR',
    ]);
  });

  it('replaces what an earlier number filled, as the number is corrected', () => {
    // Arrange: car 12 typed, its team and school filled by it.
    openTheManualEventFormWithTeams(buildTeamsOfCadastros());
    typeInto('Carro', '12');

    // Act: correct the number to 31.
    typeInto('Carro', '31');

    // Assert: car 31's team and school, not car 12's.
    expect(readCarTeamAndSchool(), 'what a number filled follows the number').toEqual([
      '31',
      'Acauã Baja',
      'Mauá',
    ]);
  });

  it('never overwrites a team the operator typed', () => {
    // Arrange: the team typed by hand first.
    openTheManualEventFormWithTeams(buildTeamsOfCadastros());
    typeInto('Equipe', 'Carnaúba');

    // Act: type car 47.
    typeInto('Carro', '47');

    // Assert: the typed team stays; only the blank school is filled.
    expect(readCarTeamAndSchool(), 'what the operator typed wins').toEqual([
      '47',
      'Carnaúba',
      'UFERSA',
    ]);
  });
});

describe('no team in Cadastros', () => {
  it('says so, and the form works as before', () => {
    // Arrange: the form, Cadastros empty.
    const { fakeServer } = openTheManualEventFormWithTeams([]);

    // Act: type a penalty for car 47 by hand, and create it.
    typeInto('Carro', '47');
    typeInto('Motivo', 'Queima de largada');
    fireEvent.click(screen.getByRole('button', { name: 'Criar evento' }));

    // Assert: the line in place of the search, and the event sent as typed.
    expect(
      screen.getByText('Nenhuma equipe nos cadastros; digite os dados'),
      'the form says why there is no team to pick',
    ).toBeVisible();
    expect(screen.queryByLabelText('Buscar equipe'), 'no search box over nothing').toBeNull();
    expect(fakeServer.listCommandsReceived(), 'the typed penalty is sent').toEqual([
      {
        type: 'createManualEvent',
        noticeKind: 'penalty',
        carNumber: 47,
        reason: 'Queima de largada',
      },
    ]);
  });
});

describe('"Sem equipe (aviso geral)"', () => {
  it('hides the car, team and school, and sends a notice with none', () => {
    // Arrange: the form set to "Aviso", car 12 picked first.
    const { fakeServer } = openTheManualEventFormWithTeams(buildTeamsOfCadastros());
    chooseOptionInDropdown('Tipo', 'Aviso');
    chooseOptionInDropdown('Equipe dos cadastros', '12 · Gralha Azul Baja · UTFPR');

    // Act: choose the general notice instead, type the text and create it.
    chooseOptionInDropdown('Equipe dos cadastros', 'Sem equipe (aviso geral)');
    typeInto('Motivo', 'Largada adiada em 15 minutos');
    fireEvent.click(screen.getByRole('button', { name: 'Criar evento' }));

    // Assert: no car, team or school on the form, nor in what is sent.
    expect(screen.queryByLabelText('Carro'), 'no car on a general notice').toBeNull();
    expect(screen.queryByLabelText('Escola'), 'no school either').toBeNull();
    expect(fakeServer.listCommandsReceived(), 'a notice about no car is sent').toEqual([
      { type: 'createManualEvent', noticeKind: 'notice', reason: 'Largada adiada em 15 minutos' },
    ]);
  });

  it('is refused as a penalty, on the page, and nothing is sent', () => {
    // Arrange: the form left on "Penalidade", the general notice chosen.
    const { fakeServer } = openTheManualEventFormWithTeams(buildTeamsOfCadastros());
    chooseOptionInDropdown('Equipe dos cadastros', 'Sem equipe (aviso geral)');
    typeInto('Motivo', 'Reabastecimento com o motor ligado');

    // Act: try to create it.
    fireEvent.click(screen.getByRole('button', { name: 'Criar evento' }));

    // Assert: refused in pt-BR, and nothing sent.
    expect(screen.getByRole('alert').textContent, 'a penalty is always given to a car').toBe(
      'Uma penalidade é sempre dada a um carro: escolha a equipe ou mude o tipo para Aviso.',
    );
    expect(fakeServer.listCommandsReceived(), 'nothing may be sent').toEqual([]);
  });
});
