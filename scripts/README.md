# scripts

Small plain-Node scripts run from the root `package.json`, with no dependency of their own.

- `serveFlexExample.js` (`pnpm serve:flex-example`): serves the fictional timing system of
  the flex source example (`packages/shared/src/flexMapping/examples/`) on
  `http://localhost:4790/cronometragem/classificacao`, the address the example config
  already reads. Import the example config on "Fontes de dados", save and turn it on; stop
  the script to see the source turn "Atrasada", start it again to see it recover.
  Each answer is stamped with the moment it is made and its session clock runs down from
  when the script started (`liveExampleResponse.js`, tested by `liveExampleResponse.test.ts`),
  so the session card shows a believable race clock rather than the file's fixed instant.
