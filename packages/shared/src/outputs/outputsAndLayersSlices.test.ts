/**
 * The outputs and layers slices (packages/shared)
 *
 * What this module is for:
 *   An output is one renderer address OBS loads as a browser source: `program`
 *   ("Programa", /render/) and any the operator adds, such as `pip` ("PiP",
 *   /render/?output=pip) for a scene with a picture-in-picture box (BAJAOVRLAY-49). Each
 *   layer belongs to one output. OutputsSchema and LayersSchema check the two slices as a
 *   whole, which a check of one row at a time cannot do.
 *
 * What these tests prove:
 *   - Program and a PiP output, with layers of the same zIndex on each, are accepted
 *     unchanged: a zIndex is unique within its output, not across outputs.
 *   - Two layers of one output with the same zIndex are refused, naming the second one.
 *   - A layer id listed twice is refused, even across outputs (an item names a layer by
 *     its id alone).
 *   - An outputs slice without `program` is refused: the program output always exists.
 *   - An output id listed twice is refused, and an output id that cannot sit in an
 *     address (a capital, a space, an accent) is refused.
 *
 * What these tests deliberately do not cover:
 *   - The commands that change outputs and layers; the server's reducer tests do.
 *   - Whether every layer's output exists: that is kept by the commands (an output with
 *     layers cannot be deleted), not by the schema.
 */
import { describe, expect, it } from 'vitest';

import { type Layer, LayersSchema } from '../slices/layer.js';
import { type Output, OutputSchema, OutputsSchema } from './output.js';

/** The program output, as every database has it. */
function buildProgramOutput(): Output {
  return { outputId: 'program', name: 'Programa', order: 0 };
}

/** The picture-in-picture output João adds for the scene with the camera box. */
function buildPipOutput(): Output {
  return { outputId: 'pip', name: 'PiP', order: 1 };
}

/** The program's lower third, at 40. */
function buildLowerThirdOfProgram(): Layer {
  return {
    id: 'lower-third',
    outputId: 'program',
    name: 'Tarja',
    zIndex: 40,
    replacePolicy: 'out-then-in',
    persistent: false,
  };
}

/** The PiP's frame around the camera box, also at 40, on its own output. */
function buildFrameOfPip(): Layer {
  return {
    id: 'moldura-pip',
    outputId: 'pip',
    name: 'Moldura',
    zIndex: 40,
    replacePolicy: 'cut',
    persistent: true,
  };
}

/** The messages of every problem a failed check found, in order. */
function listProblemMessages(result: {
  success: boolean;
  error?: { issues: { message: string }[] };
}) {
  return result.error?.issues.map((issue) => issue.message) ?? [];
}

describe('LayersSchema', () => {
  it('accepts the same zIndex on two outputs, unchanged', () => {
    // Arrange: the program's lower third and the PiP's frame, both at 40.
    const layers = [buildLowerThirdOfProgram(), buildFrameOfPip()];

    // Act: check the slice.
    const result = LayersSchema.safeParse(layers);

    // Assert: accepted as it was sent.
    expect(result.success, 'a zIndex only has to be unique within its own output').toBe(true);
    expect(result.data, 'the accepted layers must not be altered').toEqual(layers);
  });

  it('refuses two layers of one output with the same zIndex, naming the second', () => {
    // Arrange: a second program layer, "Placar", put at the lower third's 40.
    const scoreboardAtTheSameHeight: Layer = {
      ...buildLowerThirdOfProgram(),
      id: 'placar',
      name: 'Placar',
    };
    const layers = [buildLowerThirdOfProgram(), scoreboardAtTheSameHeight];

    // Act: check the slice.
    const result = LayersSchema.safeParse(layers);

    // Assert: refused, at the second layer's zIndex, with a pt-BR sentence naming both.
    expect(result.success, 'two layers at one height of one output must be refused').toBe(false);
    expect(result.error?.issues[0]?.path, 'the problem sits at the second layer').toEqual([
      1,
      'zIndex',
    ]);
    expect(listProblemMessages(result), 'the message names the layer and the height').toEqual([
      'A camada "Placar" está na mesma posição (40) que outra camada da saída "program".',
    ]);
  });

  it('refuses a layer id listed twice, even on two outputs', () => {
    // Arrange: the PiP's frame given the lower third's id by mistake.
    const layers = [buildLowerThirdOfProgram(), { ...buildFrameOfPip(), id: 'lower-third' }];

    // Act: check the slice.
    const result = LayersSchema.safeParse(layers);

    // Assert: refused at the second id; an item names a layer by its id alone.
    expect(result.success, 'a layer id must be unique across every output').toBe(false);
    expect(listProblemMessages(result), 'the message names the repeated id').toEqual([
      'A camada "lower-third" aparece duas vezes.',
    ]);
  });
});

describe('OutputsSchema', () => {
  it('accepts program and PiP, unchanged', () => {
    // Arrange: the two outputs of João's PiP scene.
    const outputs = [buildProgramOutput(), buildPipOutput()];

    // Act: check the slice.
    const result = OutputsSchema.safeParse(outputs);

    // Assert: accepted as it was sent.
    expect(result.success, 'program plus one more output must be accepted').toBe(true);
    expect(result.data, 'the accepted outputs must not be altered').toEqual(outputs);
  });

  it('refuses a slice without the program output', () => {
    // Arrange: only the PiP output.
    const outputs = [buildPipOutput()];

    // Act: check the slice.
    const result = OutputsSchema.safeParse(outputs);

    // Assert: refused; OBS's main browser source draws program, so it always exists.
    expect(result.success, 'the program output must always be there').toBe(false);
    expect(listProblemMessages(result), 'the message says program is missing').toEqual([
      'A saída "program" (Programa) precisa existir sempre.',
    ]);
  });

  it('refuses an output id listed twice', () => {
    // Arrange: two outputs called pip.
    const outputs = [buildProgramOutput(), buildPipOutput(), { ...buildPipOutput(), order: 2 }];

    // Act: check the slice.
    const result = OutputsSchema.safeParse(outputs);

    // Assert: refused at the second; the address could not tell the two apart.
    expect(result.success, 'an output id must be unique').toBe(false);
    expect(listProblemMessages(result), 'the message names the repeated id').toEqual([
      'A saída "pip" aparece duas vezes.',
    ]);
  });

  const outputIdScenarios = [
    // An address is case-sensitive in OBS's eyes but not in a person's: lower case only.
    { name: 'refuses a capital letter', outputId: 'PiP', isAccepted: false },
    // A space would have to be escaped as %20 in the browser source's URL.
    { name: 'refuses a space', outputId: 'camera box', isAccepted: false },
    // An accent would be escaped too; "câmera" is typed as "camera".
    { name: 'refuses an accent', outputId: 'câmera', isAccepted: false },
    // Hyphens between words are fine, as in the layer ids.
    { name: 'accepts words joined by hyphens', outputId: 'pip-camera-2', isAccepted: true },
  ];

  it.each(outputIdScenarios)('$name in an output id', ({ outputId, isAccepted }) => {
    // Arrange: an output named by that id.
    const output = { ...buildPipOutput(), outputId };

    // Act: check the one output.
    const result = OutputSchema.safeParse(output);

    // Assert: accepted only when it can sit in /render/?output=<id> as it is.
    expect(result.success, `the output id "${outputId}" must fit an address as it is`).toBe(
      isAccepted,
    );
  });
});
