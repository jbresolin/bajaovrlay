# apps/server/src/modules/dataSources/adapters/replay

The `replay` adapter: a recording (one JSON line per good poll, written by
`../../recorder.ts`) played back as a live source, for rehearsals (concept §7 rule 8).
Its config is the shared `ReplayConfigSchema` (`recordingId`, `speed`, `isLooping`,
`startOffsetMs`, and `replayStartedAtMs`, which the server sets when the source is
turned on).

Start reading at `replayTimeline.ts`: which recorded line answers now, and how its
shapes move onto today's timeline. Then `replayAdapter.ts`. It reads each recording
once, as a stream, starting when the source is turned on or edited
(`prepareForPolling`). A poll called off mid-read answers "Carregando a gravação…", and
a failed read gives its pt-BR reason until the next prepare. Recordings stay parsed up
to 300 MB of file. Tests replay `fridayTraining.testSupport.ts`; each
`replayAdapter*.test.ts` file names what it covers in its header.
