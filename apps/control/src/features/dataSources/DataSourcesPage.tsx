import type {
  DataSource,
  DataSourceKind,
  ReplayDataSource,
  SimulatorDataSource,
} from '@bajaovrlay/shared';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { CommandErrorMessage } from '@/features/playout/CommandErrorMessage';
import { ptBR } from '@/i18n/ptBR';
import { useServerState } from '@/state/ControlPageStateProvider';

import { DataSourceDetail } from './DataSourceDetail';
import { DataSourceRow } from './DataSourceRow';
import { ReplaySourceForm } from './ReplaySourceForm';
import { SimulatorSourceForm } from './SimulatorSourceForm';

const texts = ptBR.dataSources;

/** The form open on the page, if any: a kind's form, new (null) or on a stored source. */
type OpenSourceForm =
  | { kind: 'simulator'; sourceBeingEdited: SimulatorDataSource | null }
  | { kind: 'replay'; sourceBeingEdited: ReplayDataSource | null };

/**
 * The form "Editar" opens for a stored source: the form of its kind. A flex HTTP/JSON
 * source has no form yet (it comes later in BAJAOVRLAY-40), so "Editar" opens none.
 */
function buildEditFormOfSource(source: DataSource): OpenSourceForm | null {
  switch (source.kind) {
    case 'simulator':
      return { kind: 'simulator', sourceBeingEdited: source };
    case 'replay':
      return { kind: 'replay', sourceBeingEdited: source };
    case 'httpJson':
      return null;
  }
}

/**
 * The "Fontes de dados" page (#/fontes): on the left, "+ Fonte" and the list of sources
 * (DataSourceRow.tsx) with the refusals of their commands under it; on the right, the
 * data of the selected source (DataSourceDetail.tsx) — the first one until the operator
 * picks another by its label. On a tablet the two columns stack, list first; they sit
 * side by side from the `lg` width up. "+ Fonte" asks the kind first, then opens that
 * kind's form above the list, where "Editar" opens it too; one form at a time.
 * Which source is selected and which form is open are this page's own state: they are
 * not server state, and a refresh may forget them.
 */
export function DataSourcesPage() {
  const dataSources = useServerState((state) => state.dataSources);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [isChoosingTheKind, setIsChoosingTheKind] = useState(false);
  const [openForm, setOpenForm] = useState<OpenSourceForm | null>(null);

  // A source deleted meanwhile (here or by another operator) falls back to the first.
  const selectedSource =
    dataSources.find((source) => source.id === selectedSourceId) ?? dataSources[0];

  // An edit form whose source was deleted meanwhile (its own "Excluir", or another
  // operator) is closed: saving it could only be refused as an unknown source.
  const sourceIdBeingEdited = openForm?.sourceBeingEdited?.id;
  const isEditedSourceGone =
    sourceIdBeingEdited !== undefined &&
    !dataSources.some((source) => source.id === sourceIdBeingEdited);
  const formShown = isEditedSourceGone ? null : openForm;

  function openTheNewSourceForm(kind: DataSourceKind): void {
    setIsChoosingTheKind(false);
    setOpenForm(
      kind === 'simulator'
        ? { kind: 'simulator', sourceBeingEdited: null }
        : { kind: 'replay', sourceBeingEdited: null },
    );
  }

  function closeTheForm(): void {
    setOpenForm(null);
  }

  // A new key for every source (or new form) opened, so a form never keeps the fields
  // of the previous one.
  const openFormKey =
    formShown === null ? '' : `${formShown.kind}-${formShown.sourceBeingEdited?.id ?? 'nova'}`;

  return (
    <main className="flex flex-1 flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,30rem)_minmax(0,1fr)] lg:items-start">
      <section aria-labelledby="titulo-fontes-de-dados" className="flex min-w-0 flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 id="titulo-fontes-de-dados" className="text-xl font-semibold">
            {texts.pageTitle}
          </h2>
          <Button size="sm" onClick={() => setIsChoosingTheKind(!isChoosingTheKind)}>
            {texts.addSourceButton}
          </Button>
        </div>

        {isChoosingTheKind && (
          <div
            role="group"
            aria-label={texts.newSourceKindQuestion}
            className="flex flex-wrap items-center gap-2"
          >
            <span className="text-sm text-muted-foreground">{texts.newSourceKindQuestion}</span>
            <Button size="sm" variant="outline" onClick={() => openTheNewSourceForm('simulator')}>
              {texts.kinds.simulator}
            </Button>
            <Button size="sm" variant="outline" onClick={() => openTheNewSourceForm('replay')}>
              {texts.kinds.replay}
            </Button>
          </div>
        )}

        {formShown?.kind === 'simulator' && (
          <SimulatorSourceForm
            key={openFormKey}
            sourceBeingEdited={formShown.sourceBeingEdited}
            onClose={closeTheForm}
          />
        )}
        {formShown?.kind === 'replay' && (
          <ReplaySourceForm
            key={openFormKey}
            sourceBeingEdited={formShown.sourceBeingEdited}
            onClose={closeTheForm}
          />
        )}

        {dataSources.length === 0 ? (
          <p className="text-sm text-muted-foreground">{texts.noSources}</p>
        ) : (
          <ul aria-label={texts.sourceListLabel} className="flex flex-col gap-2">
            {dataSources.map((source) => (
              <DataSourceRow
                key={source.id}
                source={source}
                isSelected={source.id === selectedSource?.id}
                onSelect={() => setSelectedSourceId(source.id)}
                onEdit={() => setOpenForm(buildEditFormOfSource(source))}
              />
            ))}
          </ul>
        )}
        <CommandErrorMessage
          commandTypes={[
            'setDataSourceEnabled',
            'pollDataSourceNow',
            'restartSimulatedRace',
            'startRecording',
            'stopRecording',
            'deleteDataSource',
          ]}
        />
      </section>

      {selectedSource !== undefined && <DataSourceDetail source={selectedSource} />}
    </main>
  );
}
