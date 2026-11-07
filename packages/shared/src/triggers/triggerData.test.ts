/**
 * The data a trigger carries, and the body of an HTTP trigger (packages/shared)
 *
 * What this module is for:
 *   Every firing of a trigger carries its data: a flat map of pt-BR keys to texts or
 *   numbers (`{ cena: "Box" }`, `{ carro: 47, motivo: "Queima de largada" }`). An HTTP
 *   trigger's data is the body of the call, which a Stream Deck or a script writes, so
 *   readTriggerDataFromHttpBody checks that body and says in pt-BR what is wrong with it;
 *   the route answers 400 with that reason.
 *
 * What these tests prove:
 *   - An empty body is no data at all; a flat object of texts and numbers is the data.
 *   - A body that is not JSON, not an object, nests anything, carries true/false or null,
 *     names a key `__proto__`, or is over 8 KB is refused with its pt-BR reason.
 *   - TriggerDataSchema itself refuses a nested value, so no other path can store one.
 *
 * What these tests deliberately do not cover:
 *   - The route that reads the body and answers; apps/server's triggerHttpRoute.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { readTriggerDataFromHttpBody, TriggerDataSchema } from './triggerData.js';

describe('readTriggerDataFromHttpBody', () => {
  const acceptedBodies = [
    // A D200 button that only says "go" sends no body at all.
    { name: 'reads an empty body as no data', bodyText: '', expectedData: {} },
    // The brief's own example: a name for the lower third.
    {
      name: 'reads a flat object with one name',
      bodyText: '{ "nome": "Ana Souza" }',
      expectedData: { nome: 'Ana Souza' },
    },
    // A number stays a number: a car number can fill a whole-number field.
    {
      name: 'keeps a number as a number',
      bodyText: '{ "carro": 47, "equipe": "Baja UFPR" }',
      expectedData: { carro: 47, equipe: 'Baja UFPR' },
    },
  ];

  it.each(acceptedBodies)('$name', ({ bodyText, expectedData }) => {
    // Arrange: this row's body, as the device sent it.

    // Act: read it.
    const reading = readTriggerDataFromHttpBody(bodyText);

    // Assert: the data is the body's keys and values, nothing added.
    expect(reading, 'a flat body must become the trigger data as it is').toEqual({
      status: 'read',
      data: expectedData,
    });
  });

  const refusedBodies = [
    // A typo in a script: the device must hear why, not a generic error.
    {
      name: 'refuses a body that is not JSON',
      bodyText: '{ nome: Ana }',
      expectedReason: 'O corpo da chamada não é JSON válido.',
    },
    // A list has no keys to name the fields with.
    {
      name: 'refuses a list',
      bodyText: '["Ana Souza"]',
      expectedReason:
        'O corpo da chamada precisa ser um objeto JSON simples, como {"nome": "Ana Souza"}.',
    },
    // Nesting would need a path to read; the brief keeps the data flat.
    {
      name: 'refuses a nested object',
      bodyText: '{ "piloto": { "nome": "Ana Souza" } }',
      expectedReason:
        'O campo "piloto" precisa ser texto ou número (objetos, listas, true/false e null não são aceitos).',
    },
    // true/false fills no text or number field the same way twice; refused, not guessed.
    {
      name: 'refuses true or false',
      bodyText: '{ "aoVivo": true }',
      expectedReason:
        'O campo "aoVivo" precisa ser texto ou número (objetos, listas, true/false e null não são aceitos).',
    },
    // A key that would change what kind of object the data is.
    {
      name: 'refuses the key __proto__',
      bodyText: '{ "__proto__": "Ana Souza" }',
      expectedReason: 'O nome de campo "__proto__" não é aceito.',
    },
  ];

  it.each(refusedBodies)('$name', ({ bodyText, expectedReason }) => {
    // Arrange: this row's body.

    // Act: read it.
    const reading = readTriggerDataFromHttpBody(bodyText);

    // Assert: refused, with the reason the device is answered.
    expect(reading, 'a body that is not flat must be refused with its reason').toEqual({
      status: 'refused',
      reason: expectedReason,
    });
  });

  it('refuses a body over 8 KB, counted in bytes', () => {
    // Arrange: a name of 9 000 letters, well past 8 KB once in JSON.
    const bodyText = JSON.stringify({ nome: 'a'.repeat(9_000) });

    // Act: read it.
    const reading = readTriggerDataFromHttpBody(bodyText);

    // Assert: refused for its size, before anything else is looked at.
    expect(reading, 'a body over 8 KB must be refused').toEqual({
      status: 'refused',
      reason: 'O corpo da chamada passa de 8 KB.',
    });
  });

  it('counts the bytes of accented letters, not the characters', () => {
    // Arrange: 4 100 "ç", which are 4 100 characters but 8 200 bytes in UTF-8.
    const bodyText = JSON.stringify({ nome: 'ç'.repeat(4_100) });

    // Act: read it.
    const reading = readTriggerDataFromHttpBody(bodyText);

    // Assert: refused, because what travels and is stored is bytes.
    expect(reading.status, 'the limit must be in bytes, as the body travels').toBe('refused');
  });
});

describe('TriggerDataSchema', () => {
  it('refuses a nested value, so no command can carry one', () => {
    // Arrange: data with an object inside, as a buggy sender might write it.
    const nestedData = { piloto: { nome: 'Ana Souza' } };

    // Act: check it against the schema every firing passes.
    const result = TriggerDataSchema.safeParse(nestedData);

    // Assert: refused.
    expect(result.success, 'trigger data must be flat: texts and numbers only').toBe(false);
  });
});
