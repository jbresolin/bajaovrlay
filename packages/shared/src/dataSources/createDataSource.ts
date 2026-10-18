import { z } from 'zod';

import { DataSourceKindSchema } from './dataSourceKind.js';
import { PollIntervalMsSchema } from './pollInterval.js';

/**
 * Adds a data source ("+ Fonte"), off. The server gives it its id. The config is checked
 * by the server against the schema of the kind, with pt-BR errors naming `config.<field>`,
 * so here it is left unchecked.
 */
export const CreateDataSourceCommandSchema = z.object({
  type: z.literal('createDataSource'),
  label: z.string().min(1),
  kind: DataSourceKindSchema,
  config: z.unknown(),
  pollIntervalMs: PollIntervalMsSchema,
});

/** A createDataSource command after validation. */
export type CreateDataSourceCommand = z.infer<typeof CreateDataSourceCommandSchema>;
