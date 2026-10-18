import { type HttpJsonConfig, HttpJsonConfigSchema } from '@bajaovrlay/shared';

import { ptBR } from '@/i18n/ptBR';

/**
 * "Exportar configuração" and "Importar configuração": how a tested flex config travels
 * between machines, and how a preset file (the Baja app's, BAJAOVRLAY-18) gets into the
 * form. The text is the config itself, exactly what the server stores, without the
 * source's name or interval. An import is checked with the shared HttpJsonConfigSchema
 * before it fills anything, so a refused import leaves the form as it was. Pure.
 */

/** What reading a pasted config answers: the checked config, or why it was refused. */
export type FlexConfigImport =
  { isImported: true; config: HttpJsonConfig } | { isImported: false; problems: string[] };

/** Writes a config as the JSON "Exportar configuração" shows, indented to be read. */
export function writeExportedFlexConfig(config: HttpJsonConfig): string {
  return JSON.stringify(config, null, 2);
}

/**
 * Reads pasted text as a flex config: one problem when it is not JSON, otherwise each
 * refusal of the schema with the place it is at ("requests.0.url: O endereço…").
 */
export function readImportedFlexConfig(pastedText: string): FlexConfigImport {
  const texts = ptBR.dataSources.flexForm.importExport;
  let pastedJson: unknown;
  try {
    pastedJson = JSON.parse(pastedText);
  } catch {
    return { isImported: false, problems: [texts.importNotJson] };
  }

  const parsedConfig = HttpJsonConfigSchema.safeParse(pastedJson);
  if (parsedConfig.success) {
    return { isImported: true, config: parsedConfig.data };
  }
  const problems = parsedConfig.error.issues.map((issue) =>
    texts.importProblem(issue.path.map(String).join('.'), issue.message),
  );
  return { isImported: false, problems };
}
