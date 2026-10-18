import { mostRequestsPerHttpJsonSource } from '@bajaovrlay/shared';
import { useFieldArray, type UseFormReturn } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { buildErrorAttributesForControl, FormFieldRow } from '@/features/items/FormFieldRow';
import { ptBR } from '@/i18n/ptBR';

import { buildEmptyRequestFormValues, type FlexSourceFormValues } from './flexSourceFormValues';
import { readErrorMessageAtPath } from './formErrorAtPath';
import { NameAndValueRows } from './NameAndValueRows';

const texts = ptBR.dataSources.flexForm;

/** What both parts of the requests section need: the form and the start of every id. */
type FlexRequestsProps = {
  form: UseFormReturn<FlexSourceFormValues>;
  controlIdPrefix: string;
};

/**
 * The requests of the flex form: one block per GET the source makes at every poll (1 to
 * 5), each with its name, its address, and its headers and query parameters.
 */
export function FlexRequestsSection(props: FlexRequestsProps) {
  const requests = useFieldArray({ control: props.form.control, name: 'requests' });
  const isAtTheMostRequests = requests.fields.length >= mostRequestsPerHttpJsonSource;

  return (
    <section aria-label={texts.requestsTitle} className="flex flex-col gap-3">
      <h4 className="font-semibold">{texts.requestsTitle}</h4>
      {requests.fields.map((requestField, requestIndex) => (
        <FlexRequestBlock
          key={requestField.id}
          {...props}
          requestIndex={requestIndex}
          isTheOnlyRequest={requests.fields.length === 1}
          onRemove={() => requests.remove(requestIndex)}
        />
      ))}
      {!isAtTheMostRequests && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="self-start"
          onClick={() => requests.append(buildEmptyRequestFormValues())}
        >
          {texts.addRequestButton}
        </Button>
      )}
    </section>
  );
}

/** One request block: name, address, headers, query parameters, and "Remover requisição". */
function FlexRequestBlock(
  props: FlexRequestsProps & {
    requestIndex: number;
    isTheOnlyRequest: boolean;
    onRemove: () => void;
  },
) {
  const { form, requestIndex } = props;
  const errors = form.formState.errors;
  const requestPath = `requests.${requestIndex}` as const;
  const idPrefix = `${props.controlIdPrefix}-requests-${requestIndex}`;
  const ids = { requestId: `${idPrefix}-requestId`, url: `${idPrefix}-url` };
  const requestIdError = readErrorMessageAtPath(errors, `${requestPath}.requestId`);
  const urlError = readErrorMessageAtPath(errors, `${requestPath}.url`);

  return (
    <section
      aria-label={texts.requestRegionLabel(requestIndex + 1)}
      className="flex flex-col gap-3 rounded-md border border-border p-3"
    >
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <FormFieldRow
          label={texts.requestFields.requestId}
          controlId={ids.requestId}
          errorMessage={requestIdError}
        >
          <Input
            id={ids.requestId}
            placeholder={texts.requestIdPlaceholder}
            {...form.register(`${requestPath}.requestId`)}
            {...buildErrorAttributesForControl(ids.requestId, requestIdError)}
          />
        </FormFieldRow>
        <FormFieldRow label={texts.requestFields.url} controlId={ids.url} errorMessage={urlError}>
          <Input
            id={ids.url}
            inputMode="url"
            placeholder={texts.urlPlaceholder}
            {...form.register(`${requestPath}.url`)}
            {...buildErrorAttributesForControl(ids.url, urlError)}
          />
        </FormFieldRow>
      </div>
      <NameAndValueRows
        form={form}
        listPath={`${requestPath}.headers`}
        title={texts.headersTitle}
        addButtonText={texts.addHeaderButton}
        controlIdPrefix={`${idPrefix}-headers`}
      />
      <NameAndValueRows
        form={form}
        listPath={`${requestPath}.queryParameters`}
        title={texts.queryParametersTitle}
        addButtonText={texts.addQueryParameterButton}
        controlIdPrefix={`${idPrefix}-queryParameters`}
      />
      {!props.isTheOnlyRequest && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="self-start"
          onClick={props.onRemove}
        >
          {texts.removeRequestButton}
        </Button>
      )}
    </section>
  );
}
