import {
  applyFlexMapping,
  type DataShapeKey,
  type DataSnapshotShapes,
  type FlexMappingConfig,
  validateDataShape,
} from '@bajaovrlay/shared';

import { ptBR } from '@/i18n/ptBR';

/**
 * What "Testar" does, in the browser: read each sample response as JSON, run the shared
 * applyFlexMapping on them, then validateDataShape on every shape it built: the same two
 * steps, in the same order, as the server's poll of a flex source and the store after it.
 * So what passes here is what the poller will accept. Pure: the moment of the "poll" is
 * handed in.
 */

/** What testing a mapping on samples answers: the canonical shapes, or the problem lines. */
export type FlexSampleTestResult =
  { isPassing: true; shapes: DataSnapshotShapes } | { isPassing: false; problems: string[] };

/**
 * Tests a mapping on the sample text of each request it reads (`sampleTextByRequestId`,
 * as typed, pasted or fetched). A missing or broken sample is a problem of its own, named
 * by its request, before any mapping is tried.
 */
export function testFlexMappingOnSamples(
  mappings: FlexMappingConfig,
  sampleTextByRequestId: Readonly<Record<string, string>>,
  pollMomentMs: number,
): FlexSampleTestResult {
  const texts = ptBR.dataSources.flexForm.test;
  const requestIdsRead = [...new Set(mappings.map((mapping) => mapping.requestId))];

  const sampleProblems: string[] = [];
  const responsesByRequestId: Record<string, unknown> = {};
  for (const requestId of requestIdsRead) {
    const sampleText = sampleTextByRequestId[requestId] ?? '';
    if (sampleText.trim() === '') {
      sampleProblems.push(texts.sampleMissing(requestId));
      continue;
    }
    try {
      responsesByRequestId[requestId] = JSON.parse(sampleText);
    } catch {
      sampleProblems.push(texts.sampleNotJson(requestId));
    }
  }
  if (sampleProblems.length > 0) {
    return { isPassing: false, problems: sampleProblems };
  }

  const mappingResult = applyFlexMapping(mappings, responsesByRequestId, pollMomentMs);
  if (!mappingResult.ok) {
    return { isPassing: false, problems: mappingResult.problems };
  }
  return validateEveryMappedShape(mappingResult.shapes);
}

/** Runs validateDataShape on every shape the mapping built; each refusal is one problem. */
function validateEveryMappedShape(
  mappedShapes: Partial<Record<DataShapeKey, unknown>>,
): FlexSampleTestResult {
  const validShapes: Record<string, unknown> = {};
  const validationProblems: string[] = [];
  for (const [shapeKey, mappedShape] of Object.entries(mappedShapes)) {
    // Object.entries types its keys as text; they are the mapping's shape keys.
    const validation = validateDataShape(shapeKey as DataShapeKey, mappedShape);
    if (validation.isValid) {
      validShapes[shapeKey] = validation.shape;
    } else {
      validationProblems.push(validation.errorMessage);
    }
  }
  if (validationProblems.length > 0) {
    return { isPassing: false, problems: validationProblems };
  }
  // Each shape was parsed by its own schema under its own key just above.
  return { isPassing: true, shapes: validShapes as DataSnapshotShapes };
}
