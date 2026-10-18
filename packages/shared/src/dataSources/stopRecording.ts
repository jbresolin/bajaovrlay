import { z } from 'zod';

/**
 * Stops a source's recording ("Parar gravação"). The server's recorder sends it too, as
 * `sistema:gravador`, when a write to the file failed or the recording reached its 6 h
 * or 300 MB cap; it then carries the pt-BR reason, which the source shows until the next
 * recording starts. Only the recorder may send a failureMessage: the server refuses an
 * operator's stop that carries one (gate 2 on PR #16).
 */
export const StopRecordingCommandSchema = z.object({
  type: z.literal('stopRecording'),
  sourceId: z.string().min(1),
  failureMessage: z.string().min(1).optional(),
});

/** A stopRecording command after validation. */
export type StopRecordingCommand = z.infer<typeof StopRecordingCommandSchema>;
