# scripts

Small plain-Node scripts run from the root `package.json`, with no dependency of their own.

- `serveFlexExample.js` (`pnpm serve:flex-example`): serves the fictional timing system of
  the flex source example (`packages/shared/src/flexMapping/examples/`) on
  `http://localhost:4790/cronometragem/classificacao`, the address the example config
  already reads. Import the example config on "Fontes de dados", save and turn it on; stop
  the script to see the source turn "Atrasada", start it again to see it recover.
