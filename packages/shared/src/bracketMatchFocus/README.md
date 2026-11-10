# packages/shared/src/bracketMatchFocus

The match focus of a Super Prime (BAJAOVRLAY-65): which match is "agora" (the match bug's)
and which "a seguir" (the card's), per source, each chosen by the operator or empty. The
system suggests both and never moves them by itself. Start at `bracketMatchPlayOrder.ts`
(the source's order, byes left out, and each match's progress), then
`bracketMatchSuggestions.ts` (the first two matches without a winner),
`bracketMatchProposal.ts` (what "Usar sugestão" does: the operator's "a seguir" moved up
first, else the suggestion), `bracketMatchFocus.ts` (the saved slice, one focus per
source, tied to a session) and `bracketMatchFocusCommands.ts` (setBracketMatchFocus, acceptSuggestedBracketMatches).
`focusedBracketMatch.ts` reads a slot against the brackets the source sends now and builds
what the graphics receive, joined with Cadastros by car number; the binding resolver
(`../bindings/bindingResolution.ts`) reads the `matchNow.` and `matchUpNext.` paths
(`../dataShapes/bracketsBindablePaths.ts`) through it. Everything here is pure. `index.ts`
lists every export.
