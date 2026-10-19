// Test support for the httpJson config schema's tests: a config of an imaginary timing
// system's classification (one request, its positions mapping) that each test changes in
// one place, and a reader of the first problem the schema finds.
import { HttpJsonConfigSchema } from './httpJsonConfig.js';

/** The request of an imaginary timing system's classification, with no header or query. */
export function buildClassificationRequest(): Record<string, unknown> {
  return {
    requestId: 'classificacao',
    url: 'http://cronometragem.local:8080/api/classificacao',
  };
}

/** A positions mapping that reads the cars under "classificacao", from request `requestId`. */
export function buildPositionsMappingFrom(requestId: string): Record<string, unknown> {
  return {
    shapeKey: 'positions',
    requestId,
    entriesPath: 'classificacao',
    fields: [
      { targetField: 'sessionId', fromPath: 'prova.id' },
      { targetField: 'updatedAtMs', fromPollMoment: true },
    ],
    entryFields: [
      { targetField: 'position', fromListOrder: true },
      { targetField: 'carNumber', fromPath: 'carro', transformId: 'textToInteger' },
      { targetField: 'teamName', fromPath: 'equipe' },
      { targetField: 'schoolName', fromPath: 'escola' },
      { targetField: 'laps', fromPath: 'voltas' },
    ],
  };
}

/** A whole config: the classification request, its positions mapping, and `changes` on top. */
export function buildClassificationConfig(
  changes: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    requests: [buildClassificationRequest()],
    mappings: [buildPositionsMappingFrom('classificacao')],
    ...changes,
  };
}

/** The classification config whose one request has `requestChanges` on top. */
export function buildConfigWithRequestChanges(
  requestChanges: Record<string, unknown>,
): Record<string, unknown> {
  return buildClassificationConfig({
    requests: [{ ...buildClassificationRequest(), ...requestChanges }],
  });
}

/** The classification config whose positions mapping has this one extra car rule. */
export function buildConfigWithExtraCarRule(
  rule: Record<string, unknown>,
): Record<string, unknown> {
  const positionsMapping = buildPositionsMappingFrom('classificacao');
  const entryFields = positionsMapping.entryFields as unknown[];
  return buildClassificationConfig({
    mappings: [{ ...positionsMapping, entryFields: [...entryFields, rule] }],
  });
}

/** The first problem the schema found: where, and the sentence it gave. */
export function findFirstIssue(config: unknown): { path: string; message: string } | undefined {
  const parsing = HttpJsonConfigSchema.safeParse(config);
  const firstIssue = parsing.error?.issues[0];
  if (firstIssue === undefined) {
    return undefined;
  }
  return { path: firstIssue.path.map(String).join('.'), message: firstIssue.message };
}
