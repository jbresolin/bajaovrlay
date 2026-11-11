# apps/server/src/modules/bracketMatchFocus

The match focus of a Super Prime (BAJAOVRLAY-65): which match of each source's brackets is
"agora" (the match bug's) and which "a seguir" (the card's), kept in the saved
`bracketMatchFocuses` slice. Only the Produtor moves it, with two commands; nothing here
moves it by itself, not even a winner arriving. Start at `reducers/setBracketMatchFocus.ts`
("Escolher partida") and `reducers/acceptSuggestedBracketMatches.ts` ("Usar sugestão"),
which share `reducers/bracketsTheCommandNames.ts` (the source, its brackets, its session).
What a slot holds and what the graphics receive of it is shared code
(`packages/shared/src/bracketMatchFocus/`); the refresher of bound fields
(`modules/bindings/liveRefresher.ts`) rewrites the graphics on air when the slice changes.
`index.ts` lists what core may use.
