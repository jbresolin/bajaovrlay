// The backup command: `node apps/server/dist/backupDatabase.js <folder>`, run with
// `docker exec` by João's nightly script on TrueNAS into its /backups mount, and by hand on
// the stream PC into /data/backups (deploy/). It reads DATABASE_PATH as the server does, so
// inside the image it copies /data/bajaovrlay.sqlite.
import { fileURLToPath } from 'node:url';

import { writeDatabaseBackup } from './core/db/databaseBackup.js';
import { readServerEnvironment } from './core/env/readServerEnvironment.js';
import { resolveDatabasePath } from './core/env/resolveDatabasePath.js';
import { createLogger } from './core/logger/createLogger.js';

const environment = readServerEnvironment(process.env);
const logger = createLogger({ level: environment.LOG_LEVEL });

// Resolved from this file, as main.ts does, never from the folder the command runs in.
const repositoryRootFolder = fileURLToPath(new URL('../../../', import.meta.url));
const databasePath = resolveDatabasePath(environment.DATABASE_PATH, repositoryRootFolder);
const backupFolder = process.argv[2];

if (backupFolder === undefined || backupFolder === '') {
  logger.fatal('name the backup folder: node apps/server/dist/backupDatabase.js /data/backups');
  process.exit(2);
}

try {
  const outcome = await writeDatabaseBackup({ databasePath, backupFolder });
  logger.info(
    {
      database_path: databasePath,
      backup_path: outcome.backupPath,
      removed_backup_paths: outcome.removedBackupPaths,
    },
    'database backed up',
  );
} catch (backupError) {
  // A non-zero exit, so the nightly script (and its cron mail) shows the failure.
  logger.fatal({ err: backupError, database_path: databasePath }, 'database backup failed');
  process.exit(1);
}
