/**
 * The pt-BR reasons a flex HTTP/JSON source's config is refused (httpJsonConfig.ts). They
 * live in shared, like ptBRFlexMapping.ts, because the control page's form shows the
 * same sentences the server's createDataSource is checked against.
 */
export const ptBRHttpJsonConfig = {
  noRequest: 'Uma fonte HTTP/JSON precisa de pelo menos uma requisição.',
  tooManyRequests: (mostRequests: number) =>
    `Uma fonte HTTP/JSON tem no máximo ${mostRequests} requisições.`,
  badRequestId: (requestId: string) =>
    `O nome da requisição "${requestId}" só pode ter letras sem acento, números, "_" e "-", até 40 caracteres.`,
  requestIdTwice: (requestId: string) =>
    `Há mais de uma requisição chamada "${requestId}"; cada requisição tem um nome só seu.`,
  unknownKeysInRequest: (keys: string[]) =>
    keys.length === 1
      ? `A requisição tem uma chave que não existe: "${keys[0] ?? ''}".`
      : `A requisição tem chaves que não existem: ${keys.map((key) => `"${key}"`).join(', ')}.`,
  urlNotHttp: (url: string) => `O endereço "${url}" precisa começar com http:// ou https://.`,
  badHeaderName: (name: string) =>
    `O nome de cabeçalho "${name}" é inválido: use só letras, números e "-", como X-Api-Key.`,
  emptyParameterName: 'O nome do cabeçalho ou do parâmetro está vazio.',
  needsExactlyOneValue: (name: string) =>
    `"${name}" precisa de exatamente um valor: um valor digitado ou uma variável de ambiente.`,
  headerValueWithLineBreak: (name: string) =>
    `O valor do cabeçalho "${name}" não pode ter quebra de linha.`,
  environmentVariableNotAllowed: (variableName: string) =>
    `A variável de ambiente "${variableName}" não pode ser usada: só variáveis com nome BAJAOVRLAY_SOURCE_ e letras maiúsculas, números ou "_" podem ser enviadas a uma fonte.`,
  unknownRequestInMapping: (shapeName: string, requestId: string) =>
    `${shapeName} lê a requisição "${requestId}", que não existe nesta fonte.`,
};
