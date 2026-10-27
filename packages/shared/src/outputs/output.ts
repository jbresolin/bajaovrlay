import { z } from 'zod';

import { reportKeysListedTwice } from '../entities/entityKeysListedOnce.js';
import { ptBROutputs } from './ptBROutputs.js';

/**
 * The output OBS's main browser source draws (/render/ with no `output`). It always
 * exists: a new database seeds it, an older one gains it at boot with every layer it had,
 * and it can be renamed but never deleted (BAJAOVRLAY-49, João's decision).
 */
export const programOutputId = 'program';

/**
 * The layer every graphic without a usable default layer goes to, on program: the top
 * layer, where it can never replace the logo, the clock or a lower third on air. The
 * server keeps it (it cannot be deleted or moved off program), and the settings page names
 * it in the delete warning (gate 2 of PR #32).
 */
export const fallbackLayerIdOfGraphics = 'fullscreen';

/**
 * An output id as it sits in the renderer's address, /render/?output=<id>: lower-case
 * letters and digits, words joined by single hyphens, up to 30 characters. Nothing in it
 * needs escaping, so the address the settings page shows is the one typed into OBS.
 */
export const OutputIdSchema = z
  .string()
  .min(1)
  .max(30)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, ptBROutputs.outputIdNotAnAddress);

/**
 * One output: a renderer address OBS loads as a browser source, with the layers that
 * belong to it. Its id never changes once made, because an OBS scene holds it in its URL.
 */
export const OutputSchema = z.object({
  outputId: OutputIdSchema,
  /** The name the operator sees, in pt-BR ("Programa", "PiP"). */
  name: z.string().min(1).max(40),
  /**
   * The output's place in lists (settings, Camadas, the monitors' picker), from 0. The
   * server keeps it as 0, 1, 2, ... with no gaps, as it does a quick-fire panel's order.
   */
  order: z.number().int().min(0),
});

/** An output that has passed OutputSchema. */
export type Output = z.infer<typeof OutputSchema>;

/** The `outputs` slice: every output, each id once, `program` always among them. */
export const OutputsSchema = z.array(OutputSchema).superRefine((outputs, context) => {
  reportKeysListedTwice(
    outputs.map((output) => output.outputId),
    'outputId',
    ptBROutputs.outputListedTwice,
    context,
  );
  const hasProgram = outputs.some((output) => output.outputId === programOutputId);
  if (!hasProgram) {
    context.addIssue({ code: 'custom', path: [], message: ptBROutputs.programOutputMissing });
  }
});

/** The `outputs` slice, after validation. */
export type Outputs = z.infer<typeof OutputsSchema>;
