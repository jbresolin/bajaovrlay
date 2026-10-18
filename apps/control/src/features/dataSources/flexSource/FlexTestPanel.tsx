import { readServerAlignedTimeMs } from '@bajaovrlay/shared/clock';
import { useState } from 'react';
import { type UseFormReturn, useWatch } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ptBR } from '@/i18n/ptBR';

import { buildRequestFromFormValues } from './flexConfigFromFormValues';
import { FlexSampleBox } from './FlexSampleBox';
import { type FlexSampleTestResult, testFlexMappingOnSamples } from './flexSampleTesting';
import { readFlexConfigFormValues } from './flexSourceFormReading';
import type { FlexSourceFormValues } from './flexSourceFormValues';
import { FlexTestResult } from './FlexTestResult';

const texts = ptBR.dataSources.flexForm.test;

/** What "Testar" shows: nothing yet, the config's own problems, or the test's result. */
type TestOutcome =
  | { kind: 'notTestedYet' }
  | { kind: 'configHasProblems'; problems: string[] }
  | { kind: 'tested'; result: FlexSampleTestResult };

/**
 * The "Testar" panel: a sample response per request (FlexSampleBox: fetched by the
 * server with "Buscar da fonte", or pasted for an endpoint that is not up yet), and
 * "Testar", which runs the shared mapping and shape validation here in the browser
 * (flexSampleTesting.ts) and shows the canonical result in the source detail's own
 * tables, or the problems. Nothing here is saved or sent as a command.
 * Each sample is kept under its request's field id (from the form's field array), not
 * its place in the list nor its name: removing the request above, or renaming this one,
 * must leave a request with its own sample, or "Testar" would read the wrong response.
 * An import rebuilds the requests with new ids, so it starts every sample empty.
 */
export function FlexTestPanel(props: {
  form: UseFormReturn<FlexSourceFormValues>;
  /** The field id of each request block, in the form's order. */
  requestFieldIds: string[];
  controlIdPrefix: string;
}) {
  const { form } = props;
  const requestValues = useWatch({ control: form.control, name: 'requests' });
  const [sampleTextByRequestFieldId, setSampleTextByRequestFieldId] = useState<
    Record<string, string>
  >({});
  const [testOutcome, setTestOutcome] = useState<TestOutcome>({ kind: 'notTestedYet' });

  function changeSampleText(requestFieldId: string, sampleText: string): void {
    setSampleTextByRequestFieldId((previousTexts) => ({
      ...previousTexts,
      [requestFieldId]: sampleText,
    }));
  }

  function readSampleText(requestIndex: number): string {
    const requestFieldId = props.requestFieldIds[requestIndex];
    if (requestFieldId === undefined) {
      return '';
    }
    return sampleTextByRequestFieldId[requestFieldId] ?? '';
  }

  function testTheMapping(): void {
    const configReading = readFlexConfigFormValues(form.getValues());
    if (!configReading.isValid) {
      // Puts each problem under its field, as "Salvar fonte" would, but leaves the name
      // and interval alone: they play no part in a test.
      void form.trigger(['requests', 'mappings']);
      setTestOutcome({
        kind: 'configHasProblems',
        problems: [texts.configHasProblems, ...configReading.generalProblems],
      });
      return;
    }
    const sampleTextByRequestId: Record<string, string> = {};
    configReading.config.requests.forEach((request, requestIndex) => {
      sampleTextByRequestId[request.requestId] = readSampleText(requestIndex);
    });
    const result = testFlexMappingOnSamples(
      configReading.config.mappings,
      sampleTextByRequestId,
      readServerAlignedTimeMs(),
    );
    setTestOutcome({ kind: 'tested', result });
  }

  return (
    <section aria-label={texts.title} className="min-w-0">
      <Card>
        <CardHeader>
          <CardTitle>
            <h4>{texts.title}</h4>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-xs text-muted-foreground">{texts.nothingIsSaved}</p>
          {props.requestFieldIds.map((requestFieldId, requestIndex) => {
            const requestFormValues = requestValues[requestIndex];
            if (requestFormValues === undefined) {
              return null;
            }
            const typedName = requestFormValues.requestId.trim();
            const requestName =
              typedName === '' ? texts.unnamedRequest(requestIndex + 1) : typedName;
            return (
              <FlexSampleBox
                // The field id, so a box (and its "Buscar da fonte" note) stays with its request.
                key={requestFieldId}
                requestName={requestName}
                controlId={`${props.controlIdPrefix}-sample-${requestFieldId}`}
                sampleText={sampleTextByRequestFieldId[requestFieldId] ?? ''}
                onSampleTextChange={(sampleText) => changeSampleText(requestFieldId, sampleText)}
                buildRequestToFetch={() => buildRequestFromFormValues(requestFormValues)}
              />
            );
          })}
          <Button type="button" className="self-start" onClick={testTheMapping}>
            {texts.testButton}
          </Button>
          {testOutcome.kind === 'configHasProblems' && (
            <FlexTestResult result={{ isPassing: false, problems: testOutcome.problems }} />
          )}
          {testOutcome.kind === 'tested' && <FlexTestResult result={testOutcome.result} />}
        </CardContent>
      </Card>
    </section>
  );
}
