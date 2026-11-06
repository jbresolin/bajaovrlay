# packages/shared/src/eventLogReading

Reading the event log back in plain pt-BR, for the history page (`#/historico`,
BAJAOVRLAY-30). `describeEventLogEntry.ts` is where to start: it turns one event-log row into
when, who (`eventLogActors.ts`), one sentence, whether it was refused, its command group
(`eventLogCommandGroups.ts`) and the layers it touched. The sentences come from
`sentenceOfEachCommandType.ts`, a registry with one named formatter per command type, kept in
one file per group (`sentencesOf*.ts`); every word is in `ptBREventLogReading.ts`, and how a
thing is named (or reads once gone) in `namesInSentences.ts`. A poll and an import are logged
trimmed, so `trimmedPayloads.ts` reads them. `eventLogFilters.ts` holds the filters the page
applies to the live rows and the server to older pages, so both match the same sentence.
