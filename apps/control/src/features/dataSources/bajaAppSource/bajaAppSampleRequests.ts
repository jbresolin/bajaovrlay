import { buildBajaAppEndpointAddress } from '@bajaovrlay/shared';

/**
 * The reads of the Baja app's API the page makes before a source exists, each one request
 * of a flex source as the sample route takes it (POST
 * /api/v1/data-sources/http-json/sample-request): the server fetches it, checks its host
 * against BAJAOVRLAY_SOURCE_ALLOWED_HOSTS and answers the JSON. The browser never calls
 * the API itself.
 */
function buildBajaAppRequest(
  requestId: string,
  url: string,
  queryParameters: Array<{ name: string; value: string }>,
) {
  return { requestId, url, headers: [], queryParameters };
}

/** evento.php of one event: its races, tables and tournaments. */
export function buildBajaAppEventRequest(apiAddress: string, eventId: string) {
  return buildBajaAppRequest('evento', buildBajaAppEndpointAddress(apiAddress, 'evento.php'), [
    { name: 'evt', value: eventId },
  ]);
}

/** resultado.php of one table: its columns and the one it ranks by. */
export function buildBajaAppTableRequest(apiAddress: string, eventId: string, resultadoId: string) {
  return buildBajaAppRequest(
    'resultado',
    buildBajaAppEndpointAddress(apiAddress, 'resultado.php'),
    [
      { name: 'evt', value: eventId },
      { name: 'id', value: resultadoId },
    ],
  );
}

/** equipes.php of one event: its teams, for "Importar equipes do app Baja". */
export function buildBajaAppTeamsRequest(apiAddress: string, eventId: string) {
  return buildBajaAppRequest('equipes', buildBajaAppEndpointAddress(apiAddress, 'equipes.php'), [
    { name: 'evt', value: eventId },
  ]);
}
