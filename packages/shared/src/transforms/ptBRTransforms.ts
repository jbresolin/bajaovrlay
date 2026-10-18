/**
 * The pt-BR texts of the transform registry: each transform's label and description, and
 * the reasons a transform gives when it cannot read a value. They live in shared, like
 * ptBRDataShapes.ts, because the server's poll error and the control page's "Testar" panel
 * show the same reason as it is. Each reason takes the value already quoted
 * (quoteValueForReason.ts), so every reason names what it could not read.
 */
export const ptBRTransforms = {
  /** What a reason quotes when there was no value at all. */
  noValueQuote: 'nenhum valor',

  /** The label and description of each transform, by its id. */
  transforms: {
    textToNumber: {
      label: 'Texto para número',
      description:
        'Lê um número escrito como texto, com vírgula ou ponto decimal: "12,5" e "12.5" viram 12,5. Recusa texto ambíguo como "1.234,5".',
    },
    textToInteger: {
      label: 'Texto para número inteiro',
      description: 'Lê um número inteiro escrito como texto: "42" vira 42. Recusa casas decimais.',
    },
    secondsToMs: {
      label: 'Segundos para milissegundos',
      description:
        'Converte um número de segundos em milissegundos inteiros, arredondando para o milissegundo mais próximo: 278,293 vira 278 293.',
    },
    lapTimeTextToMs: {
      label: 'Tempo de volta (texto) para milissegundos',
      description:
        'Lê um tempo como "4:38.293", "4:38,293", "278.293" ou "1:02:03.4" e dá o tempo em milissegundos.',
    },
    isoDateTextToMs: {
      label: 'Data e hora ISO 8601 para milissegundos',
      description:
        'Lê um instante com fuso, como "2027-08-14T14:30:00-03:00", e dá os milissegundos desde 1970. Recusa um instante sem fuso.',
    },
    unixSecondsToMs: {
      label: 'Segundos desde 1970 para milissegundos',
      description:
        'Converte um instante em segundos desde 1970 (horário Unix) em milissegundos: 1818264600 vira 1818264600000.',
    },
    trimText: {
      label: 'Remover espaços das pontas',
      description:
        'Tira os espaços do começo e do fim de um texto: "  Baja UFPR " vira "Baja UFPR".',
    },
    mapValues: {
      label: 'Tabela de valores',
      description:
        'Troca o valor da fonte pelo valor da tabela: "BOX" vira "inPit". Um valor que não está na tabela é recusado.',
    },
  },

  /** Why a transform could not read the value it was given. */
  reasons: {
    notText: (quotedValue: string) => `${quotedValue} não é um texto`,
    notANumber: (quotedValue: string) => `${quotedValue} não é um número`,
    ambiguousNumberText: (quotedValue: string) =>
      `${quotedValue} é ambíguo: um número deve ter no máximo um separador decimal, vírgula ou ponto, e nenhum separador de milhar`,
    notAnInteger: (quotedValue: string) => `${quotedValue} não é um número inteiro`,
    integerTooLarge: (quotedValue: string) =>
      `${quotedValue} é grande demais para ser lido sem perder dígitos`,
    notALapTime: (quotedValue: string) =>
      `${quotedValue} não é um tempo de volta como 4:38.293, 278.293 ou 1:02:03.4`,
    notAnIsoMoment: (quotedValue: string) =>
      `${quotedValue} não é uma data e hora ISO 8601 como 2027-08-14T14:30:00-03:00`,
    isoMomentWithoutZone: (quotedValue: string) =>
      `${quotedValue} não tem fuso horário; sem ele o horário pode sair horas errado (escreva como 2027-08-14T14:30:00-03:00 ou 2027-08-14T17:30:00Z)`,
    momentNotInCalendar: (quotedValue: string) => `${quotedValue} não existe no calendário`,
    notATableKey: (quotedValue: string) =>
      `${quotedValue} não pode ser procurado na tabela de valores, que só procura textos, números e verdadeiro/falso`,
    valueNotInTable: (quotedValue: string) => `${quotedValue} não está na tabela de valores`,
  },

  /** Why the parameters given to a transform were refused. */
  parameterReasons: {
    unknownTransform: (transformId: string) => `A transformação "${transformId}" não existe.`,
    takesNoParameters: (transformLabel: string) =>
      `A transformação "${transformLabel}" não recebe parâmetros.`,
    invalidParameters: (transformLabel: string) =>
      `Os parâmetros da transformação "${transformLabel}" são inválidos.`,
    mapValuesTableMustBeObject:
      'A tabela de valores deve ser um objeto JSON como { "BOX": "inPit", "PISTA": "running" }.',
    mapValuesTableIsEmpty: 'A tabela de valores está vazia.',
  },
};
