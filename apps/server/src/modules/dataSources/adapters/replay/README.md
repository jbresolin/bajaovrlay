# apps/server/src/modules/dataSources/adapters/replay

The `replay` adapter: a recording (one JSON line per good poll, written by
`../../recorder.ts`) played back as a live source, for rehearsals (concept §7 rule 8).
Its config is the shared `ReplayConfigSchema` (`recordingId`, `speed`, `isLooping`,
`startOffsetMs`, and `replayStartedAtMs`, which the server sets when the source is
turned on).

Start reading at `replayTimeline.ts`: which recorded line answers now (offset, speed,
loop or hold the last line), and how its shapes move onto today's timeline
(`updatedAtMs` and the session clock, stopped once a plain replay has ended). Then
`replayAdapter.ts`: reading a recording once as a stream, parsing each line without
checking its shapes (so a large recording never stalls the server), keeping parsed
recordings in memory up to 300 MB of file, least recently polled let go first, checking
only the line a poll answers, and the pt-BR errors for a missing, empty or bad file.
`fridayTraining.testSupport.ts` is the recording the tests replay;
`replayAdapterLoading.test.ts` loads a 50 MB one (`../../largeRecording.testSupport.ts`).
