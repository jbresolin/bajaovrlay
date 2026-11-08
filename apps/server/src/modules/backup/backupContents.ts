// What goes into a backup from the data folder, and how large each part is on disk now.
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** One file of the data folder as the zip will hold it. */
export type FileInTheBackup = {
  /** Its path inside the zip, with forward slashes: media/<mediaId>, recordings/<id>/<file>. */
  pathInTheZip: string;
  pathOnDisk: string;
  /** Its size when listed; a recording still being written may have grown by the time it is read. */
  sizeInBytes: number;
};

/** How large each part of a backup is on disk now, for "Cópia de segurança". */
export type SizesOfTheBackupParts = {
  databaseSizeInBytes: number;
  mediaSizeInBytes: number;
  recordingsSizeInBytes: number;
};

/**
 * Every file under `folderOnDisk`, subfolders included (a recording lives in
 * recordings/<sourceId>/), named for the zip under `folderNameInTheZip`, in name order.
 * A missing folder lists nothing: a server that never recorded has no recordings folder.
 */
export function listFilesInFolderForTheBackup(
  folderOnDisk: string,
  folderNameInTheZip: string,
): FileInTheBackup[] {
  if (!existsSync(folderOnDisk)) {
    return [];
  }
  const filesFound: FileInTheBackup[] = [];
  const entries = readdirSync(folderOnDisk, { withFileTypes: true });
  const entriesInNameOrder = [...entries].sort((first, second) =>
    first.name.localeCompare(second.name),
  );
  for (const entry of entriesInNameOrder) {
    const pathOnDisk = join(folderOnDisk, entry.name);
    const pathInTheZip = `${folderNameInTheZip}/${entry.name}`;
    if (entry.isDirectory()) {
      filesFound.push(...listFilesInFolderForTheBackup(pathOnDisk, pathInTheZip));
      continue;
    }
    // A link or a socket in the data folder is not the server's data; only plain files go in.
    if (entry.isFile()) {
      filesFound.push({ pathInTheZip, pathOnDisk, sizeInBytes: statSync(pathOnDisk).size });
    }
  }
  return filesFound;
}

/** Adds up the sizes of a list of files. */
export function addUpFileSizes(files: readonly FileInTheBackup[]): number {
  let totalSizeInBytes = 0;
  for (const file of files) {
    totalSizeInBytes += file.sizeInBytes;
  }
  return totalSizeInBytes;
}

/**
 * The size on disk now of the database file, of DATA_DIR/media and of
 * DATA_DIR/recordings. The copy of the database in the zip is within a few pages of the
 * file's size, so the sum is what the zip will weigh.
 */
export function measureTheBackupParts(locations: {
  databasePath: string;
  mediaFolder: string;
  recordingsFolder: string;
}): SizesOfTheBackupParts {
  const databaseSizeInBytes = existsSync(locations.databasePath)
    ? statSync(locations.databasePath).size
    : 0;
  const mediaFiles = listFilesInFolderForTheBackup(locations.mediaFolder, 'media');
  const recordingFiles = listFilesInFolderForTheBackup(locations.recordingsFolder, 'recordings');
  return {
    databaseSizeInBytes,
    mediaSizeInBytes: addUpFileSizes(mediaFiles),
    recordingsSizeInBytes: addUpFileSizes(recordingFiles),
  };
}
