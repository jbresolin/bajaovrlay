// Serves the fictional timing system of the flex source example on this machine, so the
// flex source can be tried for real without a timing system (`pnpm serve:flex-example`).
// It answers GET /cronometragem/classificacao with
// packages/shared/src/flexMapping/examples/timing-system-like.response.json, which is the
// address the example config already reads, so the config imports with no change.
// Each answer carries the moment it is made and a session clock run down since the script
// started (liveExampleResponse.js), so the session card shows a believable race clock.
// Stop it (Ctrl+C) to see the source turn "Atrasada"; start it again to see it recover.
// Plain Node with no dependency, so it runs with nothing installed but Node 22.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';

import { stampExampleResponseWithTheMomentOfAnswer } from './liveExampleResponse.js';

// The port and path of the example config's request (timing-system-like.config.json).
// 127.0.0.1 only: the BajaOvrLay server reading it runs on this same machine.
const port = 4790;
const host = '127.0.0.1';
const classificacaoPath = '/cronometragem/classificacao';

const exampleResponsePath = fileURLToPath(
  new URL(
    '../packages/shared/src/flexMapping/examples/timing-system-like.response.json',
    import.meta.url,
  ),
);
// Read once at start and checked as JSON, so a broken file stops here with its reason
// instead of answering bad JSON at every poll.
/** @type {import('./liveExampleResponse.js').ExampleTimingSystemResponse} */
const exampleResponse = JSON.parse(readFileSync(exampleResponsePath, 'utf8'));
const scriptStartedAtMs = Date.now();

const server = createServer((request, response) => {
  if (request.method !== 'GET' || request.url !== classificacaoPath) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end(`Só existe GET ${classificacaoPath} aqui.\n`);
    return;
  }
  const answer = stampExampleResponseWithTheMomentOfAnswer(
    exampleResponse,
    scriptStartedAtMs,
    Date.now(),
  );
  response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(answer));
});

server.listen(port, host, () => {
  // The project bans console.log (the server logs through its JSON logger); this script
  // writes its one line to the terminal directly.
  process.stdout.write(
    `Exemplo fictício de cronometragem em http://localhost:${port}${classificacaoPath}\n` +
      'Ctrl+C para parar.\n',
  );
});
