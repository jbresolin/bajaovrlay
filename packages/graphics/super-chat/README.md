# super-chat (`@bajaovrlay/super-chat`)

The Super Chat OGraf graphic in Ardósia (BAJAOVRLAY-35): a 420 px card top-left under the bug, on
the `notice` layer, where the notice sits. The server names it `super-chat` (its folder). It shows a
viewer's paid YouTube message once a person approved it: "SUPER CHAT" and the amount in a navy cell
in the head, the author, then the message. No message (or one of YouTube's emoji shortcodes alone)
leaves the amount and the author. The author and the message scroll inside their boxes when too long
(the kit's `scrollingTextWhenTooLong`). No YouTube logo, no tier colours: theme tokens only.
Start reading at `src/super-chat.ts` (the notice's lifecycle), which wires `superChatModel.ts` (Zod
data: `amountText`, `authorName` required, `messageText` optional), `superChatView.ts`,
`youTubeEmojiShortcodes.ts` (`:face-blue-smiling:` taken out; Unicode emoji stay, drawn by
`--font-emoji`), `superChatStyles.ts`, `superChatAnimations.ts` and `ptBR.ts`.
Preview: `pnpm --filter @bajaovrlay/super-chat dev`, then http://localhost:5222/preview.html (add
`?data=<url-encoded JSON>`). Unit tests: `pnpm --filter @bajaovrlay/super-chat test`; Playwright:
`pnpm --filter @bajaovrlay/super-chat test:e2e` (`--update-snapshots` after a deliberate change; the
emoji screenshot needs Noto Color Emoji on the machine, as on CI).
