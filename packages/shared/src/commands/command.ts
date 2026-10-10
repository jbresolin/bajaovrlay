import { z } from 'zod';

import { ClearAllCommandSchema } from './clearAll.js';
import { ClearLayerCommandSchema } from './clearLayer.js';
import { ReportInstanceStatusCommandSchema } from './reportInstanceStatus.js';
import { TakeGraphicCommandSchema } from './takeGraphic.js';
import { UpdateInstanceDataCommandSchema } from './updateInstanceData.js';

/**
 * Every command the server accepts, told apart by `type`. A command is the only way
 * state changes. takeItem and the rundown commands arrive later in M1.
 */
export const CommandSchema = z.discriminatedUnion('type', [
  TakeGraphicCommandSchema,
  UpdateInstanceDataCommandSchema,
  ReportInstanceStatusCommandSchema,
  ClearLayerCommandSchema,
  ClearAllCommandSchema,
]);

/** A command after validation, with defaults filled in. */
export type Command = z.infer<typeof CommandSchema>;

/** A command as a client writes it, before defaults (takeGraphic's target may be left out). */
export type CommandInput = z.input<typeof CommandSchema>;
