import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { ActionButton } from '@/features/connection/ActionButton';
import { ptBR } from '@/i18n/ptBR';
import { useSendCommandAndReadItsRefusal, useServerState } from '@/state/ControlPageStateProvider';

import { fetchSimulatorTeams } from './simulatorTeamsFetch';

const texts = ptBR.entityLibrary.simulator;

/** Where the button is: waiting, asking whether to replace stored teams, or importing. */
type ImportStep = 'idle' | 'confirming' | 'importing';

/**
 * "Importar equipes do simulador" on the Equipes tab: loads the simulator's hundred
 * fictional teams into the library for walks and rehearsals, labelled as fictional.
 * With teams already stored it asks first, in words on the page (no browser dialog, which
 * would freeze the page in a show), since a simulator team replaces the team of the same
 * car. It fetches the teams from the server, then sends them as one importEntities.
 */
export function SimulatorTeamsImportButton() {
  const storedTeamCount = useServerState((state) => state.teams.length);
  const sendCommandAndReadItsRefusal = useSendCommandAndReadItsRefusal();
  const [importStep, setImportStep] = useState<ImportStep>('idle');
  const [outcomeMessage, setOutcomeMessage] = useState<string | null>(null);

  async function importTheSimulatorTeams(): Promise<void> {
    setImportStep('importing');
    setOutcomeMessage(null);
    const fetched = await fetchSimulatorTeams();
    if (!fetched.isFetched) {
      setOutcomeMessage(fetched.reason);
      setImportStep('idle');
      return;
    }
    const refusal = await sendCommandAndReadItsRefusal({
      type: 'importEntities',
      entityType: 'team',
      records: fetched.teams,
    });
    setOutcomeMessage(refusal ?? texts.imported(fetched.teams.length));
    setImportStep('idle');
  }

  function pressTheButton(): void {
    if (storedTeamCount > 0) {
      setImportStep('confirming');
      return;
    }
    void importTheSimulatorTeams();
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <ActionButton
          size="sm"
          variant="outline"
          disabled={importStep !== 'idle'}
          onClick={pressTheButton}
        >
          {importStep === 'importing' ? texts.loading : texts.importButton}
        </ActionButton>
        <span className="text-xs text-muted-foreground">{texts.fictionalHint}</span>
      </div>
      {importStep === 'confirming' && (
        <div role="group" className="flex flex-wrap items-center gap-2 text-sm">
          <span>{texts.confirmQuestion(storedTeamCount)}</span>
          <ActionButton
            size="sm"
            variant="destructive"
            onClick={() => void importTheSimulatorTeams()}
          >
            {texts.confirmButton}
          </ActionButton>
          <Button size="sm" variant="ghost" onClick={() => setImportStep('idle')}>
            {texts.cancelButton}
          </Button>
        </div>
      )}
      {outcomeMessage !== null && (
        <p role="status" className="text-sm">
          {outcomeMessage}
        </p>
      )}
    </div>
  );
}
