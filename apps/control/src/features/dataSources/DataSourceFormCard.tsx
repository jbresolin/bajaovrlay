import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ActionButton } from '@/features/connection/ActionButton';
import { CommandErrorMessage } from '@/features/playout/CommandErrorMessage';
import { ptBR } from '@/i18n/ptBR';

/** What the frame of a source form needs. */
export type DataSourceFormCardProps = {
  /** "Nova fonte: Simulador", "Editar fonte: Ensaio de sexta"; also the region's name. */
  title: string;
  /** True while the save waits for the server, so a second press cannot send it twice. */
  isWaitingForTheServer: boolean;
  /** True once this form's own save was refused, so the server's reason is shown. */
  wasLastSaveRefused: boolean;
  onSave: () => void;
  onCancel: () => void;
  /** The kind's own fields. */
  children: ReactNode;
};

/**
 * The frame both source forms share: the title, the fields, the server's refusal of this
 * form's save in its pt-BR words, "Salvar fonte" and "Cancelar". Enter in a field does nothing,
 * as in every form of the page: only the button sends.
 */
export function DataSourceFormCard(props: DataSourceFormCardProps) {
  const texts = ptBR.dataSources.form;
  return (
    <section aria-label={props.title}>
      <Card>
        <CardHeader>
          <CardTitle>
            <h3>{props.title}</h3>
          </CardTitle>
        </CardHeader>
        <form noValidate onSubmit={(event) => event.preventDefault()}>
          <CardContent className="flex flex-col gap-4">
            {props.children}
            {props.wasLastSaveRefused && (
              <CommandErrorMessage commandTypes={['createDataSource', 'updateDataSource']} />
            )}
          </CardContent>
          <CardFooter className="mt-4 gap-2">
            <ActionButton
              type="button"
              disabled={props.isWaitingForTheServer}
              onClick={props.onSave}
            >
              {texts.saveButton}
            </ActionButton>
            <Button type="button" variant="ghost" onClick={props.onCancel}>
              {texts.cancelButton}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </section>
  );
}
