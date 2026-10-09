/**
 * pt-BR catalog: every string the operator reads on the control page comes from here,
 * never written inline in a component, so the wording can be reviewed in one place.
 */
export const ptBR = {
  app: {
    title: 'BajaOvrLay',
  },
  serverHealth: {
    checkButton: 'Verificar servidor',
    checking: 'Verificando o servidor…',
    online: (version: string) => `Servidor no ar, versão ${version}.`,
    unreachable: 'Não foi possível falar com o servidor.',
  },
} as const;
