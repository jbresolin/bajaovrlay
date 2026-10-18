import { z } from 'zod';

/** Starts recording every good poll of an enabled source to a new file ("Gravar"). */
export const StartRecordingCommandSchema = z.object({
  type: z.literal('startRecording'),
  sourceId: z.string().min(1),
});

/** A startRecording command after validation. */
export type StartRecordingCommand = z.infer<typeof StartRecordingCommandSchema>;
