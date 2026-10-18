import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ptBR } from '@/i18n/ptBR';

import { fetchHttpJsonSample } from './fetchHttpJsonSample';

const texts = ptBR.dataSources.flexForm.test;

/** What "Buscar da fonte" last said: nothing yet, the status it got, or why it failed. */
type FetchNote =
  { kind: 'none' } | { kind: 'fetched'; status: number } | { kind: 'failed'; error: string };

/**
 * The sample of one request in the "Testar" panel: a box for its JSON, which the operator
 * pastes into or "Buscar da fonte" fills with what the server fetched (indented, to be
 * read). A failed fetch says why in the server's pt-BR words and leaves the box as it was.
 */
export function FlexSampleBox(props: {
  requestName: string;
  controlId: string;
  sampleText: string;
  onSampleTextChange: (sampleText: string) => void;
  /** The request as the form holds it now, read at the press. */
  buildRequestToFetch: () => unknown;
}) {
  const [isFetching, setIsFetching] = useState(false);
  const [fetchNote, setFetchNote] = useState<FetchNote>({ kind: 'none' });

  async function fetchTheSample(): Promise<void> {
    setIsFetching(true);
    try {
      const answer = await fetchHttpJsonSample(props.buildRequestToFetch());
      if (answer.ok) {
        props.onSampleTextChange(JSON.stringify(answer.body, null, 2));
        setFetchNote({ kind: 'fetched', status: answer.status });
      } else {
        setFetchNote({ kind: 'failed', error: answer.error });
      }
    } finally {
      setIsFetching(false);
    }
  }

  return (
    <div
      role="group"
      aria-label={texts.sampleRegionLabel(props.requestName)}
      className="flex flex-col gap-2"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label htmlFor={props.controlId}>{texts.sampleLabel(props.requestName)}</Label>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isFetching}
          onClick={() => void fetchTheSample()}
        >
          {isFetching ? texts.fetchingButton : texts.fetchButton}
        </Button>
      </div>
      <Textarea
        id={props.controlId}
        rows={8}
        spellCheck={false}
        className="field-sizing-fixed max-h-80 font-mono text-xs"
        value={props.sampleText}
        onChange={(event) => props.onSampleTextChange(event.target.value)}
      />
      {fetchNote.kind === 'fetched' && (
        <p className="text-xs text-muted-foreground">{texts.fetchedStatus(fetchNote.status)}</p>
      )}
      {fetchNote.kind === 'failed' && (
        <p role="alert" className="text-sm text-destructive">
          {fetchNote.error}
        </p>
      )}
    </div>
  );
}
