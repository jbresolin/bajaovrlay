import { z } from 'zod';

/**
 * Stops a source's recording ("Parar gravação"). The server's recorder sends it too, as
 * `sistema:gravador`, when a write to the file failed; it then carries the pt-BR reason,
 * which the source shows until the next recording starts.
 */
export const StopRecordingCommandSchema = z.object({
  type: z.literal('stopRecording'),
  sourceId: z.string().min(1),
  failureMessage: z.string().min(1).optional(),
});

/** A stopRecording command after validation. */
export type StopRecordingCommand = z.infer<typeof StopRecordingCommandSchema>;
