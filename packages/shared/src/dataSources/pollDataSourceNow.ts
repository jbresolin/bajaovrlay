import { z } from 'zod';

/** Asks for one poll of an enabled source at once ("Atualizar agora"). */
export const PollDataSourceNowCommandSchema = z.object({
  type: z.literal('pollDataSourceNow'),
  sourceId: z.string().min(1),
});

/** A pollDataSourceNow command after validation. */
export type PollDataSourceNowCommand = z.infer<typeof PollDataSourceNowCommandSchema>;
