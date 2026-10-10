# apps/control/src/logging

The control page's only way to write a log line. Start reading at `controlLog.ts`.

- `controlLog.ts` — `logControlEvent` writes one JSON line (level, message, time,
  details) to the browser console, shaped like the server's and the renderer's lines.

It is for things a developer investigates later (a server message the page could not
read), never for things the operator must see: those go on screen, in pt-BR. Every other
`console` call is banned by ESLint.
