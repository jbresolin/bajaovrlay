# packages/graphics

On-air graphics, one folder per graphic, each an EBU OGraf v1 package: a `*.ograf.json`
manifest plus a web component (Lit, GSAP for animation, CSS custom properties for theme
values). Graphics receive resolved data only and never fetch anything themselves.

`race-clock/` is the first graphic and the template every later graphic copies: start
reading at its README.md, which also says how to copy it.

Each graphic folder is its own workspace package (`pnpm-workspace.yaml` already lists
`packages/graphics/*`). A graphic joins the checks without editing anything at the root:
a `vitest.config.ts` is picked up by `pnpm test`, and a `test:e2e` script by
`pnpm test:e2e` and CI, provided it depends on `"@playwright/test": "catalog:"`.
