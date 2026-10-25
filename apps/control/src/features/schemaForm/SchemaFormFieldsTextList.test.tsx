/**
 * A list of texts on screen: add, remove, reorder and its messages (apps/control)
 *
 * What this module is for:
 *   The message ticker's messages are typed in the item editor line by line
 *   (BAJAOVRLAY-23): one text input per message, "Adicionar mensagem" under them,
 *   "Remover mensagem N" on each, and a numbered handle to drag a message to another
 *   place, with the mouse or the keyboard, as the macro editor's steps are. This is how an
 *   operator adds an announcement during the event.
 *
 * What these tests prove:
 *   - The messages on air are drawn one per line, each input named "Mensagem N".
 *   - "Adicionar mensagem" adds an empty line at the end; typing in it puts the text in
 *     the form and marks the list as changed.
 *   - "Remover mensagem 1" takes that line out and the others move up.
 *   - The keyboard drag (Space, ArrowDown, Space on "Mover mensagem 1") puts the first
 *     message second, and the drop is announced as "Mensagem 1", not "Linha 1".
 *   - The count under a line leaves out the spaces around it, as the form sends it.
 *   - When the form is checked, a message over the limit shows its pt-BR reason under the
 *     list, giving the line and the limit; a list emptied of its last message says it is
 *     required, and the empty list says "Ainda não há mensagem.".
 *   - A list of objects beside it is still the read-only box.
 *
 * What these tests deliberately do not cover:
 *   - The rules and their every message; schemaFormTextList.test.ts.
 *   - A real mouse drag (jsdom lays nothing out, so the drag test gives each line a place);
 *     the keyboard drag runs the same code.
 */
import { act, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildSchemaFormValuesFromDataOnAir } from './buildSchemaFormValues';
import { describeSchemaFormFromDataSchema } from './describeSchemaFormFromDataSchema';
import {
  buildMessageTickerFixtureDataSchema,
  buildTwoEnduroMorningMessages,
  describeMessageTickerFixtureForm,
} from './messageTickerFixtureSchema.testSupport';
import { pressButton, renderSchemaFormOnTestPage } from './schemaFormOnTestPage.testSupport';

/** Draws the ticker's form filled from the air with these messages. */
function renderTickerFormWithMessages(messages: string[]) {
  const description = describeMessageTickerFixtureForm();
  const { formValues } = buildSchemaFormValuesFromDataOnAir(description, {
    label: 'AVISO',
    messages,
  });
  return renderSchemaFormOnTestPage({ description, formValues });
}

/** The texts in the message inputs, top to bottom. */
function readMessagesOnScreen(): string[] {
  const list = screen.getByRole('list', { name: 'Mensagens' });
  return within(list)
    .getAllByRole('textbox')
    .map((input) => (input as HTMLInputElement).value);
}

describe('the ticker’s messages on screen', () => {
  // The drag test takes the timers and the layout; whatever happens in it, the next test
  // gets real ones back.
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('draws each message on air as one named line', () => {
    // Arrange and act: the ticker's form with the two morning messages.
    renderTickerFormWithMessages(buildTwoEnduroMorningMessages());

    // Assert: two lines, each input named after its number.
    expect(readMessagesOnScreen(), 'one line per message, in order').toEqual(
      buildTwoEnduroMorningMessages(),
    );
    expect(
      screen.getByRole('textbox', { name: 'Mensagem 2' }),
      'the second line is named "Mensagem 2"',
    ).toHaveValue('Briefing dos pilotos na tenda central');
  });

  it('adds an empty message at the end and takes what is typed in it', () => {
    // Arrange: the ticker with two messages.
    const page = renderTickerFormWithMessages(buildTwoEnduroMorningMessages());

    // Act: add a message and type the third announcement in it.
    pressButton('Adicionar mensagem');
    fireEvent.change(screen.getByRole('textbox', { name: 'Mensagem 3' }), {
      target: { value: 'Premiação às 18h00 no palco' },
    });

    // Assert: three lines, the new one last, and the list counts as changed.
    expect(page.readFormValues().values.messages, 'the new message is the third line').toEqual([
      { text: 'Largada do enduro às 10h00' },
      { text: 'Briefing dos pilotos na tenda central' },
      { text: 'Premiação às 18h00 no palco' },
    ]);
    expect(page.readDirtyFields().values?.messages, 'the list is marked as changed').toBeTruthy();
  });

  it('removes a message and moves the others up', () => {
    // Arrange: the ticker with two messages.
    const page = renderTickerFormWithMessages(buildTwoEnduroMorningMessages());

    // Act: remove the first.
    pressButton('Remover mensagem 1');

    // Assert: only the briefing is left, now the first line.
    expect(readMessagesOnScreen(), 'the second message moved up').toEqual([
      'Briefing dos pilotos na tenda central',
    ]);
    expect(page.readFormValues().values.messages, 'the form holds one line').toEqual([
      { text: 'Briefing dos pilotos na tenda central' },
    ]);
  });

  it('puts the first message second with the keyboard drag', async () => {
    // Arrange: the ticker with two messages, each line given a place on screen 48 px under
    // the one before (jsdom lays nothing out, and dnd-kit reads the places), and dnd-kit's
    // timers under the test's hand.
    vi.useFakeTimers();
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element,
    ) {
      const linesOnScreen = Array.from(document.querySelectorAll('li'));
      const lineOfThisElement = this.closest('li');
      const lineIndex = lineOfThisElement === null ? 0 : linesOnScreen.indexOf(lineOfThisElement);
      return new DOMRect(0, lineIndex * 48, 480, 48);
    });
    const page = renderTickerFormWithMessages(buildTwoEnduroMorningMessages());
    const handleOfTheFirstMessage = screen.getByRole('button', { name: 'Mover mensagem 1' });

    // Act: pick the first message up, move it one line down and drop it.
    for (const keyCode of ['Space', 'ArrowDown', 'Space']) {
      await act(async () => {
        fireEvent.keyDown(handleOfTheFirstMessage, {
          code: keyCode,
          key: keyCode === 'Space' ? ' ' : keyCode,
        });
        await vi.advanceTimersByTimeAsync(20);
      });
    }

    // Assert: the briefing comes first now in the form, and a screen reader heard the
    // message named as the list names it.
    expect(page.readFormValues().values.messages, 'the order follows the drag').toEqual([
      { text: 'Briefing dos pilotos na tenda central' },
      { text: 'Largada do enduro às 10h00' },
    ]);
    expect(
      screen.getByText('Mensagem 1 na posição nova.'),
      'the drop is announced with the line named by the item title',
    ).toBeInTheDocument();
  });
});

describe('the count under a message', () => {
  it('counts the message as it will be sent, without the spaces at its end', () => {
    // Arrange: the ticker with the start message.
    renderTickerFormWithMessages(['Largada do enduro às 10h00']);

    // Act: type two spaces after it, as an operator does before thinking of more.
    fireEvent.change(screen.getByRole('textbox', { name: 'Mensagem 1' }), {
      target: { value: 'Largada do enduro às 10h00  ' },
    });

    // Assert: 26 of 50, the length that is sent, not 28.
    expect(
      screen.getByText('26/50'),
      'the count must leave out the spaces the form trims',
    ).toBeInTheDocument();
  });
});

describe('the ticker’s messages when the form is checked', () => {
  it('shows the reason of a message over the limit under the list, with the line and the limit', async () => {
    // Arrange: the ticker with one message, then a second too long for the bar.
    const page = renderTickerFormWithMessages(['Largada do enduro às 10h00']);
    pressButton('Adicionar mensagem');
    fireEvent.change(screen.getByRole('textbox', { name: 'Mensagem 2' }), {
      target: {
        value: 'Atenção equipes: o reabastecimento fecha às 13h30 e reabre após a bandeira verde',
      },
    });

    // Act: check the form, as a press of "Salvar item" does.
    const isValid = await page.checkTheForm();

    // Assert: refused, with the pt-BR reason giving the line and the limit.
    expect(isValid, 'a message over the limit must stop the save').toBe(false);
    expect(
      screen.getByText('Mensagem 2: no máximo 50 caracteres (tem 80).'),
      'the reason is under the list',
    ).toBeInTheDocument();
  });

  it('says the messages are required when the last one is removed', async () => {
    // Arrange: the ticker with one message, then that message removed.
    const page = renderTickerFormWithMessages(['Largada do enduro às 10h00']);
    pressButton('Remover mensagem 1');

    // Act: check the form.
    const isValid = await page.checkTheForm();

    // Assert: refused, the list required, and the empty list says it has no line.
    expect(isValid, 'a ticker with no message must stop the save').toBe(false);
    expect(
      screen.getByText('O campo "Mensagens" é obrigatório.'),
      'the reason is under the list',
    ).toBeInTheDocument();
    expect(
      screen.getByText('Ainda não há mensagem.'),
      'the empty list says so',
    ).toBeInTheDocument();
  });
});

describe('a list of objects beside a list of texts', () => {
  it('is still the read-only box', () => {
    // Arrange: the ticker's schema with a list of sponsors (objects) added.
    const dataSchema = buildMessageTickerFixtureDataSchema();
    const properties = dataSchema.properties as Record<string, unknown>;
    properties.patrocinadores = {
      type: 'array',
      title: 'Patrocinadores',
      items: { type: 'object', properties: { nome: { type: 'string' } } },
    };
    const description = describeSchemaFormFromDataSchema(dataSchema);
    const { formValues } = buildSchemaFormValuesFromDataOnAir(description, {
      label: 'AVISO',
      messages: ['Largada do enduro às 10h00'],
      patrocinadores: [{ nome: 'Mineradora Serra Azul' }],
    });

    // Act: draw the form.
    renderSchemaFormOnTestPage({ description, formValues });

    // Assert: the messages are inputs, the sponsors a read-only box with their JSON.
    expect(
      screen.getByRole('textbox', { name: 'Mensagem 1' }),
      'the messages are typed',
    ).toHaveValue('Largada do enduro às 10h00');
    expect(
      screen.getByRole('textbox', { name: 'Patrocinadores' }),
      'the sponsors are shown for reading only',
    ).toHaveAttribute('readonly');
  });
});
