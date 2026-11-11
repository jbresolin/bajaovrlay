# packages/shared/src/consoles

Two consoles on one layer (BAJAOVRLAY-69). A console is one tab of the control page; the
server tells consoles apart by `consoleId.ts`, handed out in the tab's first `hello` and
kept in its sessionStorage. Every take a console sends carries what it showed on air on the
layer it takes on (`whatTheConsoleSawOnAir.ts`): `takeItem`, `takeNext` and `takePreview`
one instance id or null, `takeAllPreviews` one per layer.

Start with `whatTheConsoleSawOnAir.ts`. The server's rule (refuse a take only when another
console changed that layer less than 2 s ago, unseen) lives in
apps/server/src/core/store/consoles/, and the page stamps every take in
apps/control/src/state/whatThisPageSawOnAir.ts.
