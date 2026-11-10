# apps/control/src/features/bracketMatchFocus

"Partidas da chave" on the console's right column (BAJAOVRLAY-65): for each source that sends a
Super Prime, the match "agora" (the match bug's) and "a seguir" (the "a seguir" card's), the
proposal of the next match once "agora" has its winner ("Partida encerrada: Corisco venceu.
Próxima sugerida: …"), "Usar sugestão" and "Escolher partida". Start at
`matchFocusOfEachSource.ts`, which reads all of it from the slices with the shared rules
(`packages/shared/src/bracketMatchFocus`); `BracketMatchFocusPanel.tsx` draws it and sends
setBracketMatchFocus and acceptSuggestedBracketMatches; `ChooseBracketMatchDialog.tsx` lists every
match with its progress and suggestion. The panel never moves "agora" by itself, and greys its
buttons out for Dados. The words are `src/i18n/ptBRBracketMatchFocus.ts`.
