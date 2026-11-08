// Test support: reading a backup zip back, as the operator's unzip would, with yauzl (the
// reading half of yazl's author). Used by the server's tests and the control page's e2e.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Readable } from 'node:stream';

import Database from 'better-sqlite3';
import yauzl from 'yauzl';

/** Reads one whole stream into a buffer. */
async function readStreamWhole(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

/** Every file of a zip, by its path inside it; rejects when the zip cannot be read. */
export async function readEveryFileOfZip(zipBytes: Buffer): Promise<Map<string, Buffer>> {
  // lazyEntries: one entry at a time, read whole before the next is asked for.
  const zipFile = await new Promise<yauzl.ZipFile>((resolve, reject) => {
    yauzl.fromBuffer(zipBytes, { lazyEntries: true }, (openError, openedZip) => {
      if (openError !== null) {
        reject(openError);
        return;
      }
      resolve(openedZip);
    });
  });
  const filesByPath = new Map<string, Buffer>();
  await new Promise<void>((resolve, reject) => {
    zipFile.on('entry', (entry: yauzl.Entry) => {
      zipFile.openReadStream(entry, (streamError, entryStream) => {
        if (streamError !== null) {
          reject(streamError);
          return;
        }
        readStreamWhole(entryStream)
          .then((fileBytes) => {
            filesByPath.set(entry.fileName, fileBytes);
            zipFile.readEntry();
          })
          .catch(reject);
      });
    });
    zipFile.once('end', () => resolve());
    zipFile.once('error', reject);
    zipFile.readEntry();
  });
  return filesByPath;
}

/** What the tests read from the database a backup holds. */
export type DatabaseOfTheBackup = {
  /** What PRAGMA integrity_check says: "ok" for a whole copy. */
  integrity: string;
  quickFirePanelNames: string[];
  itemLabels: string[];
};

/** The names (or labels) in one slice row of the backup's database, an empty list when none. */
function readNamesInSlice(database: Database.Database, sliceName: string, key: string): string[] {
  const sliceRow = database.prepare('SELECT json FROM slices WHERE name = ?').get(sliceName) as
    { json: string } | undefined;
  if (sliceRow === undefined) {
    return [];
  }
  const records = JSON.parse(sliceRow.json) as Array<Record<string, unknown>>;
  return records.map((record) => String(record[key]));
}

/**
 * Opens the database a backup holds, read-only, from a temporary file, and answers what
 * PRAGMA integrity_check says, the quick-fire panels' names and the items' labels. The
 * file is closed and removed before it answers, so no test framework is needed (the
 * control page's e2e uses it too).
 */
export function readTheDatabaseOfTheBackup(databaseBytes: Buffer): DatabaseOfTheBackup {
  const folder = mkdtempSync(join(tmpdir(), 'bajaovrlay-copia-lida-'));
  const databasePath = join(folder, 'bajaovrlay.sqlite');
  writeFileSync(databasePath, databaseBytes);
  const database = new Database(databasePath, { readonly: true });
  try {
    const integrityRow = database.prepare('PRAGMA integrity_check').get() as {
      integrity_check: string;
    };
    return {
      integrity: integrityRow.integrity_check,
      quickFirePanelNames: readNamesInSlice(database, 'quickFirePanels', 'name'),
      itemLabels: readNamesInSlice(database, 'items', 'label'),
    };
  } finally {
    database.close();
    rmSync(folder, { recursive: true, force: true });
  }
}
