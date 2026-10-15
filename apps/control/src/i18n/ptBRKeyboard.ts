/**
 * pt-BR catalog, keyboard part: the names of the keys and what each shortcut does, as the
 * "?" dialog shows them (src/keyboard/keyboardMap.ts reads them from here). Kept in a file
 * of its own so ptBR.ts stays readable; ptBR.ts makes it `ptBR.keyboard`.
 */

// Most shortcuts share where they are left alone; written once so all of them say it alike.
const ignoredWhileTyping =
  'Fora de campos de texto, listas, menus abertos e chaves; sem Ctrl, Alt ou Cmd; não repete se a tecla ficar apertada.';

export const ptBRKeyboard = {
  // The "?" button in the header and the dialog it opens.
  helpButton: '?',
  helpButtonLabel: 'Atalhos do teclado',
  dialogTitle: 'Atalhos do teclado',
  dialogDescription:
    'Todos os atalhos da página. Nenhum funciona enquanto a página está sem conexão com o servidor.',
  closeDialogButton: 'Fechar',
  // The three column headers of the list.
  keyColumn: 'Tecla',
  descriptionColumn: 'O que faz',
  conditionColumn: 'Quando',
  // One entry per shortcut: the key as the operator reads it, when it works, what it does.
  shortcuts: {
    takeNext: {
      keyName: 'Espaço',
      condition: `${ignoredWhileTyping} Funciona também com o foco num botão, que então não é apertado.`,
      description:
        'Põe no ar o próximo item: a prévia, se ela mostra o item do cursor; senão, o item do cursor.',
    },
    previewCursorItem: {
      keyName: 'Shift + Espaço',
      condition: ignoredWhileTyping,
      description: 'Mostra o item do cursor na prévia, sem pôr nada no ar.',
    },
    cursorForward: {
      keyName: '→',
      condition: ignoredWhileTyping,
      description: 'Move o cursor para o item seguinte do rundown, sem pôr nada no ar.',
    },
    cursorBack: {
      keyName: '←',
      condition: ignoredWhileTyping,
      description: 'Move o cursor para o item anterior do rundown, sem pôr nada no ar.',
    },
    discardPreview: {
      keyName: 'Backspace',
      condition: ignoredWhileTyping,
      description: 'Descarta a prévia mais recente. Nunca tira nada do ar.',
    },
    clearAll: {
      keyName: 'Esc',
      condition:
        'Em qualquer lugar, mesmo digitando. Não conta quando fecha uma lista, um menu ou esta janela.',
      description:
        'Limpar tudo: a primeira vez arma o botão, a segunda em até 3 segundos tira tudo do ar.',
    },
    fireQuickFireButton: {
      keyName: '1 a 9',
      condition: ignoredWhileTyping,
      description:
        'Dispara o 1º ao 9º botão da aba de atalhos aberta; na aba Macros, roda a 1ª à 9ª macro. Não move o cursor do rundown.',
    },
    switchQuickFireTab: {
      keyName: 'F1 a F4',
      condition: ignoredWhileTyping,
      description:
        'Abre a 1ª à 4ª aba de atalhos, na ordem em que aparecem; a aba Macros conta como a última.',
    },
  },
} as const;
