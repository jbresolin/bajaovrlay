import { useFieldArray, type UseFormReturn, useWatch } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { ptBR } from '@/i18n/ptBR';

import { FlexMappingBlock } from './FlexMappingBlock';
import {
  buildEmptyMappingFormValues,
  type FlexSourceFormValues,
  mappableShapeKeys,
} from './flexSourceFormValues';

const texts = ptBR.dataSources.flexForm;

/**
 * The mappings of the flex form: one block per shape the source produces
 * (FlexMappingBlock), and "+ Sessão", "+ Posições", "+ Pontuação" for the shapes not
 * mapped yet, since each shape comes from one mapping only. A new block reads the first
 * request, the usual case of a source with one endpoint.
 */
export function FlexMappingsSection(props: {
  form: UseFormReturn<FlexSourceFormValues>;
  controlIdPrefix: string;
}) {
  const { form } = props;
  const mappings = useFieldArray({ control: form.control, name: 'mappings' });
  const mappingValues = useWatch({ control: form.control, name: 'mappings' });
  const requestValues = useWatch({ control: form.control, name: 'requests' });

  const shapeKeysMapped = new Set(mappingValues.map((mapping) => mapping.shapeKey));
  const shapeKeysToOffer = mappableShapeKeys.filter((shapeKey) => !shapeKeysMapped.has(shapeKey));
  const firstRequestId = requestValues[0]?.requestId.trim() ?? '';
  // The names typed so far, each once and none empty: what a mapping's dropdown offers.
  const requestIdsToOffer = [
    ...new Set(requestValues.map((request) => request.requestId.trim())),
  ].filter((requestId) => requestId !== '');

  return (
    <section aria-label={texts.mappingsTitle} className="flex flex-col gap-3">
      <h4 className="font-semibold">{texts.mappingsTitle}</h4>
      {mappings.fields.length === 0 && (
        <p className="text-sm text-muted-foreground">{texts.noMappings}</p>
      )}
      {mappings.fields.map((mappingField, mappingIndex) => (
        <FlexMappingBlock
          key={mappingField.id}
          form={form}
          mappingIndex={mappingIndex}
          shapeKey={mappingField.shapeKey}
          requestIdsToOffer={requestIdsToOffer}
          controlIdPrefix={`${props.controlIdPrefix}-mappings-${mappingIndex}`}
          onRemove={() => mappings.remove(mappingIndex)}
        />
      ))}
      {shapeKeysToOffer.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {shapeKeysToOffer.map((shapeKey) => (
            <Button
              key={shapeKey}
              type="button"
              size="sm"
              variant="outline"
              onClick={() => mappings.append(buildEmptyMappingFormValues(shapeKey, firstRequestId))}
            >
              {texts.addMappingButton(texts.shapeNames[shapeKey])}
            </Button>
          ))}
        </div>
      )}
    </section>
  );
}
