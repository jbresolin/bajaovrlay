import { z } from 'zod';

/**
 * Removes a source and its snapshot ("Excluir"). Its recordings stay listed, so they can
 * still be replayed.
 */
export const DeleteDataSourceCommandSchema = z.object({
  type: z.literal('deleteDataSource'),
  sourceId: z.string().min(1),
});

/** A deleteDataSource command after validation. */
export type DeleteDataSourceCommand = z.infer<typeof DeleteDataSourceCommandSchema>;
