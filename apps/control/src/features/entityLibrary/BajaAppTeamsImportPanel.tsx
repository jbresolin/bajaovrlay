import { bajaAppApiAddress, type Team } from '@bajaovrlay/shared';
import { useId, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { buildBajaAppTeamsRequest } from '@/features/dataSources/bajaAppSource/bajaAppSampleRequests';
import {
  findProblemOfTypedApiAddress,
  findProblemOfTypedEventId,
} from '@/features/dataSources/bajaAppSource/bajaAppTypedIds';
import { fetchHttpJsonSample } from '@/features/dataSources/flexSource/fetchHttpJsonSample';
import { buildErrorAttributesForControl, FormFieldRow } from '@/features/items/FormFieldRow';
import { ptBR } from '@/i18n/ptBR';

import { writeBajaAppTeamsAsCsvText } from './bajaAppTeamsAsCsv';

const texts = ptBR.entityLibrary.bajaApp;

/** What the tab gives the panel. */
export type BajaAppTeamsImportPanelProps = {
  /** The teams stored now: a blank of the app keeps what they hold. */
  storedTeams: Team[];
  /** Called with the teams written as the Equipes CSV, and the line to show above it. */
  onTeamsRead: (csvText: string, note: string) => void;
  onClose: () => void;
};

/**
 * "Importar equipes do app Baja" (BAJAOVRLAY-54): the operator types the event id (and,
 * only for a local copy such as `pnpm serve:baja-example`, the API's address, as on
 * Fontes), the page reads its teams (equipes.php) through the server's sample route,
 * which checks the host against BAJAOVRLAY_SOURCE_ALLOWED_HOSTS, and writes them as the
 * Equipes CSV (bajaAppTeamsAsCsv.ts). The tab then opens "Importar CSV" with that text,
 * so the preview and the import are the CSV's own. Nothing is sent from here.
 */
export function BajaAppTeamsImportPanel(props: BajaAppTeamsImportPanelProps) {
  const apiAddressControlId = useId();
  const eventIdControlId = useId();
  const [apiAddress, setApiAddress] = useState(bajaAppApiAddress);
  const [eventId, setEventId] = useState('');
  const [isReading, setIsReading] = useState(false);
  // What is wrong with what was typed, under the field it belongs to; a failed read goes
  // under the event, which is what the operator changes next.
  const [addressProblem, setAddressProblem] = useState<string | undefined>(undefined);
  const [problem, setProblem] = useState<string | undefined>(undefined);

  async function readTheTeams(): Promise<void> {
    const typedAddress = apiAddress.trim();
    const typedEventId = eventId.trim();
    const typedAddressProblem = findProblemOfTypedApiAddress(typedAddress);
    const typedEventIdProblem = findProblemOfTypedEventId(typedEventId);
    setAddressProblem(typedAddressProblem);
    setProblem(typedEventIdProblem);
    if (typedAddressProblem !== undefined || typedEventIdProblem !== undefined) {
      return;
    }
    setIsReading(true);
    const answer = await fetchHttpJsonSample(buildBajaAppTeamsRequest(typedAddress, typedEventId));
    setIsReading(false);
    if (!answer.ok) {
      setProblem(answer.error);
      return;
    }
    const written = writeBajaAppTeamsAsCsvText(answer.body, props.storedTeams);
    if (!written.isWritten) {
      setProblem(written.reason);
      return;
    }
    props.onTeamsRead(written.csvText, texts.teamsRead(written.teamCount, typedEventId));
  }

  return (
    <section aria-label={texts.importButton} className="flex flex-col gap-3 rounded-lg border p-4">
      <h3 className="font-semibold">{texts.importButton}</h3>
      <FormFieldRow
        label={texts.apiAddressLabel}
        controlId={apiAddressControlId}
        errorMessage={addressProblem}
      >
        <Input
          id={apiAddressControlId}
          value={apiAddress}
          onChange={(event) => setApiAddress(event.target.value)}
          {...buildErrorAttributesForControl(apiAddressControlId, addressProblem)}
        />
      </FormFieldRow>
      <p className="text-xs text-muted-foreground">{texts.apiAddressHint}</p>
      <FormFieldRow label={texts.eventIdLabel} controlId={eventIdControlId} errorMessage={problem}>
        <Input
          id={eventIdControlId}
          value={eventId}
          onChange={(event) => setEventId(event.target.value)}
          {...buildErrorAttributesForControl(eventIdControlId, problem)}
        />
      </FormFieldRow>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={isReading} onClick={() => void readTheTeams()}>
          {isReading ? texts.readingTeams : texts.readTeamsButton}
        </Button>
        <Button size="sm" variant="ghost" onClick={props.onClose}>
          {ptBR.entityLibrary.csv.closeButton}
        </Button>
      </div>
    </section>
  );
}
