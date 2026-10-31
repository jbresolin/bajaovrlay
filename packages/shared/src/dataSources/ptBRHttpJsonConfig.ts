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
  // A key that is not there at all, or one holding something other than text or a list.
  missingField: (fieldName: string) => `Falta o campo "${fieldName}".`,
  fieldNotText: (fieldName: string) => `O campo "${fieldName}" precisa ser um texto.`,
  fieldNotAList: (fieldName: string) => `O campo "${fieldName}" precisa ser uma lista.`,
  // Something other than an object where a config, a request, a header or a parameter goes.
  configNotAnObject: 'A configuração precisa ser um objeto com "requests" e "mappings".',
  requestNotAnObject: 'Cada requisição precisa ser um objeto com "requestId" e "url".',
  headerNotAnObject:
    'Cada cabeçalho precisa ser um objeto com "name" e "value" (ou "valueFromEnvironment").',
  queryParameterNotAnObject:
    'Cada parâmetro precisa ser um objeto com "name" e "value" (ou "valueFromEnvironment").',
  // A misspelt key, or one that does not exist ("method"), at each level of the config.
  unknownKeysInConfig: (keys: string[]) => `A configuração tem ${describeUnknownKeys(keys)}.`,
  unknownKeysInRequest: (keys: string[]) => `A requisição tem ${describeUnknownKeys(keys)}.`,
  unknownKeysInHeader: (name: string | undefined, keys: string[]) =>
    name === undefined
      ? `O cabeçalho tem ${describeUnknownKeys(keys)}.`
      : `O cabeçalho "${name}" tem ${describeUnknownKeys(keys)}.`,
  unknownKeysInQueryParameter: (name: string | undefined, keys: string[]) =>
    name === undefined
      ? `O parâmetro tem ${describeUnknownKeys(keys)}.`
      : `O parâmetro "${name}" tem ${describeUnknownKeys(keys)}.`,
  urlNotHttp: (url: string) => `O endereço "${url}" precisa começar com http:// ou https://.`,
  // The address is not quoted: it holds a password.
  urlWithCredentials:
    'O endereço tem usuário ou senha escritos nele: credenciais vão num cabeçalho, com o valor lido de uma variável BAJAOVRLAY_SOURCE_.',
  badHeaderName: (name: string) =>
    `O nome de cabeçalho "${name}" é inválido: use só letras, números e "-", como X-Api-Key.`,
  headerControlledByTheServer: (name: string) =>
    `O cabeçalho "${name}" é controlado pelo próprio servidor e não pode ser definido.`,
  emptyParameterName: 'O nome do parâmetro está vazio.',
  needsExactlyOneValue: (name: string) =>
    `"${name}" precisa de exatamente um valor: um valor digitado ou uma variável de ambiente.`,
  headerValueWithLineBreak: (name: string) =>
    `O valor do cabeçalho "${name}" não pode ter quebra de linha.`,
  headerValueWithCharacterHttpRefuses: (name: string) =>
    `O valor do cabeçalho "${name}" tem um caractere que um cabeçalho HTTP não aceita, como um emoji ou uma letra fora do Latin-1.`,
  environmentVariableNotAllowed: (variableName: string) =>
    `A variável de ambiente "${variableName}" não pode ser usada: só variáveis com nome BAJAOVRLAY_SOURCE_ e letras maiúsculas, números ou "_" podem ser enviadas a uma fonte.`,
  unknownRequestInMapping: (shapeName: string, requestId: string) =>
    `${shapeName} lê a requisição "${requestId}", que não existe nesta fonte.`,
  unknownRequestInLookup: (shapeName: string, lookupName: string, requestId: string) =>
    `A consulta "${lookupName}" de ${shapeName} lê a requisição "${requestId}", que não existe nesta fonte.`,
  refreshEveryMsOutOfRange: (shortestMs: number, longestMs: number) =>
    `O tempo de atualização da requisição vai de 1 minuto (${shortestMs} ms) a 1 hora (${longestMs} ms), em milissegundos inteiros.`,
};

/**
 * "uma chave que não existe: "x"" or "chaves que não existem: "x", "y"". A function
 * declaration, so the catalog above can call it although it is written below.
 */
function describeUnknownKeys(keys: string[]): string {
  const quotedKeys = keys.map((key) => `"${key}"`).join(', ');
  if (keys.length === 1) {
    return `uma chave que não existe: ${quotedKeys}`;
  }
  return `chaves que não existem: ${quotedKeys}`;
}
