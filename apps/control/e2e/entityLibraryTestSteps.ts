// Test support for the browser tests of the "Cadastros" page (BAJAOVRLAY-19): opening the
// page, a real PNG logo to upload, and reading the library from the real server's state.
import { crc32, deflateSync } from 'node:zlib';

import { expect, type Page } from '@playwright/test';

import { realServerPort } from './emptyTheServerState';

/** One PNG chunk: length, type, data, and the CRC over type and data. */
function buildPngChunk(chunkType: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(chunkType, 'ascii'), data]);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, checksum]);
}

/** A real 64×64 PNG, every pixel the green of Juriti Off-Road (#15803D): team 7's logo. */
export function buildLogoOfTeam7(): Buffer {
  const sizePx = 64;
  const header = Buffer.alloc(13);
  header.writeUInt32BE(sizePx, 0);
  header.writeUInt32BE(sizePx, 4);
  header.writeUInt8(8, 8);
  header.writeUInt8(6, 9);
  const oneRow = Buffer.alloc(1 + sizePx * 4);
  for (let pixel = 0; pixel < sizePx; pixel += 1) {
    oneRow.set([0x15, 0x80, 0x3d, 0xff], 1 + pixel * 4);
  }
  const rows = Buffer.concat(Array.from({ length: sizePx }, () => oneRow));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    buildPngChunk('IHDR', header),
    buildPngChunk('IDAT', deflateSync(rows)),
    buildPngChunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Opens "Cadastros" (#/cadastros) and waits until it is connected to the server. */
export async function openTheEntityLibraryPage(page: Page): Promise<void> {
  await page.goto('/#/cadastros');
  await expect(
    page.getByRole('status', { name: 'Conexão com o servidor' }),
    'Cadastros must connect to the server before anything can be saved',
  ).toHaveText('Conectado');
}

/** The parts of GET /api/v1/state these tests read. */
type LibraryAsTheTestsReadIt = {
  teams: { carNumber: number; teamName: string; logoMediaId?: string }[];
  people: { personId: string }[];
  media: { mediaId: string }[];
};

/** Reads the library and the images the real server holds. */
export async function readTheLibraryFromTheRealServer(): Promise<LibraryAsTheTestsReadIt> {
  const response = await fetch(`http://127.0.0.1:${String(realServerPort)}/api/v1/state`);
  return (await response.json()) as LibraryAsTheTestsReadIt;
}

/** Uploads a PNG to the real server's media store from the test itself, as a page would. */
export async function uploadALogoToTheRealServer(): Promise<string> {
  const form = new FormData();
  form.append(
    'file',
    new File([new Uint8Array(buildLogoOfTeam7())], 'logo.png', { type: 'image/png' }),
  );
  const response = await fetch(`http://127.0.0.1:${String(realServerPort)}/api/v1/media`, {
    method: 'POST',
    body: form,
  });
  const answer = (await response.json()) as { mediaId: string };
  return answer.mediaId;
}
