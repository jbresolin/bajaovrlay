/**
 * pt-BR catalog for every message the server sends to people (error answers the
 * control page shows to the operator). Log messages stay in English: they are for
 * developers and are searched with tools, not read on air.
 */
export const ptBR = {
  errors: {
    routeNotFound: 'Endereço não encontrado no servidor.',
    unexpectedServerError:
      'Erro inesperado no servidor. Procure no log do servidor o request_id desta resposta.',
  },
  // Answers to commands and WebSocket messages; each goes with a stable code
  // (CommandErrorCodeSchema in @bajaovrlay/shared).
  commandErrors: {
    invalidCommandField: (fieldPath: string) =>
      `Comando inválido: o campo "${fieldPath}" está ausente ou tem um valor errado.`,
    invalidCommandShape: 'Comando inválido: envie um objeto com o campo "type".',
    commandNotAllowed: 'Você não tem permissão para executar este comando.',
    layerNotFound: (layerId: string) => `A camada "${layerId}" não existe.`,
    graphicNotFound: (graphicId: string) => `O gráfico "${graphicId}" não está registrado.`,
    instanceNotFound: (instanceId: string) =>
      `A instância "${instanceId}" não existe; o gráfico pode já ter saído do ar.`,
    // "Tomar" was pressed for a layer whose preview is empty (already taken or discarded).
    layerPreviewEmpty: (layerName: string) =>
      `Não há nada em prévia na camada "${layerName}" para colocar no ar.`,
    // The four ways a take's or an update's data can fail the graphic's manifest
    // schema. The first three name the field, so the operator knows what to correct.
    graphicDataFieldMissing: (graphicId: string, fieldPath: string) =>
      `Dados inválidos para o gráfico "${graphicId}": o campo "${fieldPath}" é obrigatório e não foi enviado.`,
    graphicDataFieldUnknown: (graphicId: string, fieldPath: string) =>
      `Dados inválidos para o gráfico "${graphicId}": o campo "${fieldPath}" não existe neste gráfico.`,
    graphicDataFieldValueInvalid: (graphicId: string, fieldPath: string) =>
      `Dados inválidos para o gráfico "${graphicId}": o campo "${fieldPath}" tem um valor que o gráfico não aceita.`,
    graphicDataSchemaUnusable: (graphicId: string) =>
      `O gráfico "${graphicId}" tem um esquema de dados que o servidor não consegue ler. Corrija o manifesto do gráfico e reinicie o servidor.`,
    // A command asked the server to write its own moment into a field that the
    // graphic's manifest does not mark as a wall-clock moment.
    graphicFieldCannotBeStamped: (graphicId: string, fieldKey: string) =>
      `O gráfico "${graphicId}" não aceita que o servidor preencha o campo "${fieldKey}" com o momento do comando: o manifesto do gráfico não marca esse campo como um horário (número inteiro com v_baja.role "wallClock").`,
    // The two ways the update rule a manifest names (v_baja.updateRule) cannot be run.
    // Both are mistakes in the manifest, so both say what to correct and where.
    graphicUpdateRuleUnknown: (graphicId: string, ruleName: string) =>
      `O gráfico "${graphicId}" não pode ser atualizado no ar: o manifesto dele pede a regra de atualização "${ruleName}", que o servidor não conhece. Corrija o manifesto do gráfico e reinicie o servidor.`,
    graphicUpdateRuleFieldsMissing: (
      graphicId: string,
      ruleName: string,
      missingFieldKeys: string[],
    ) =>
      `O gráfico "${graphicId}" não pode ser atualizado no ar: o manifesto dele pede a regra de atualização "${ruleName}", mas o esquema de dados não declara os campos de que ela precisa (${missingFieldKeys.join(', ')}). Corrija o manifesto do gráfico e reinicie o servidor.`,
    invalidMessage: 'Mensagem inválida: o servidor aceita apenas mensagens JSON do protocolo.',
    unexpectedServerError:
      'Erro inesperado no servidor ao executar o comando. Procure o erro no log do servidor.',
  },
  // Names of the layers seeded on the first boot, as the operator sees them.
  seededLayerNames: {
    bug: 'Logo',
    ticker: 'Letreiro',
    clock: 'Relógio',
    lowerThird: 'Tarja',
    fullscreen: 'Tela cheia',
  },
  // Name of the one rundown seeded on the first boot, as the operator sees it.
  seededRundownName: 'Sessão principal',
  // Refusals of the rundown and item commands; each goes with a stable code, like
  // commandErrors above. A rundown and an item are named by what the
  // operator reads on screen (name, label) whenever the server has it, and by id when
  // the id is all there is because the thing was not found.
  rundownCommandErrors: {
    itemNotFound: (itemId: string) => `O item "${itemId}" não existe; ele pode ter sido excluído.`,
    rundownNotFound: (rundownId: string) => `O rundown "${rundownId}" não existe.`,
    itemNotInRundown: (itemLabel: string, rundownName: string) =>
      `O item "${itemLabel}" pertence a outro rundown, não a "${rundownName}".`,
    itemsNotAPermutation: (rundownName: string) =>
      `A nova ordem do rundown "${rundownName}" não confere com os itens dele: ela precisa trazer todos os itens do rundown, cada um uma única vez.`,
    rundownCursorEmpty: (rundownName: string) =>
      `O rundown "${rundownName}" não tem próximo item: o cursor não está em nenhum item. Escolha o próximo item antes de colocar no ar.`,
    unsupportedFieldKind: (fieldKey: string, fieldKind: string) =>
      `O campo "${fieldKey}" usa um valor do tipo "${fieldKind}", que o servidor só vai saber resolver no marco M2 (BAJAOVRLAY-20). Por enquanto, preencha o campo com um valor literal.`,
  },
} as const;
