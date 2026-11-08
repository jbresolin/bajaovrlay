// The two routes of the backup download (BAJAOVRLAY-33), declared with their Zod schemas
// so the OpenAPI document describes them; api/v1/mountBackupRoutes.ts mounts them.
import { BackupDownloadQuerySchema, BackupSummarySchema } from '@bajaovrlay/shared';
import { createRoute, z } from '@hono/zod-openapi';

import { type ErrorAnswerBody, ErrorAnswerBodySchema } from '../../core/http/errorAnswers.js';
import { ptBR } from '../../core/messages/ptBR.js';

// Who may call them, as for GET /api/v1/event-log: the control page with no token, any
// other caller as the command API allows. Until the control page's session lands
// (BAJAOVRLAY-29), which will take its place.
const accessResponses = {
  401: {
    description: 'From outside the control page: a missing, malformed or wrong token.',
    content: { 'application/json': { schema: ErrorAnswerBodySchema } },
  },
  403: {
    description: 'From outside the control page, with the command API turned off.',
    content: { 'application/json': { schema: ErrorAnswerBodySchema } },
  },
};

/** `GET /api/v1/backup`: the zip of the data folder, streamed as it is made. */
export const getBackupRoute = createRoute({
  method: 'get',
  path: '/backup',
  summary: 'One zip of the database, the media and (unless left out) the recordings',
  description:
    'Streams bajaovrlay-AAAA-MM-DD-HHMM.zip (São Paulo time): bajaovrlay.sqlite, a ' +
    'consistent copy made with SQLite’s online backup; media/; recordings/ unless ' +
    '`includeRecordings=false`; and leia-me.txt. Files are stored, not compressed. One ' +
    'backup at a time; a finished one writes an event-log row (recordBackup, ' +
    'sistema:backup) with its size.',
  request: { query: BackupDownloadQuerySchema },
  responses: {
    200: {
      description: 'The zip, sent as an attachment while it is being made.',
      content: { 'application/zip': { schema: z.string().openapi({ format: 'binary' }) } },
    },
    400: {
      description: 'An includeRecordings that is not "true" or "false".',
      content: { 'application/json': { schema: ErrorAnswerBodySchema } },
    },
    409: {
      description: 'Another backup is still being sent.',
      content: { 'application/json': { schema: ErrorAnswerBodySchema } },
    },
    ...accessResponses,
  },
});

/** `GET /api/v1/backup/summary`: what "Cópia de segurança" shows before the download. */
export const getBackupSummaryRoute = createRoute({
  method: 'get',
  path: '/backup/summary',
  summary: 'The size of each part of a backup now, and the newest backup made',
  description:
    'The database, media and recordings sizes on disk now (a backup weighs their sum, ' +
    'without the recordings when they are left out), and the moment and size of the ' +
    'newest backup in the event log, or null when none was ever made, and whether a ' +
    'backup is being sent now (a second would be refused).',
  responses: {
    200: {
      description: 'The sizes and the newest backup.',
      content: { 'application/json': { schema: BackupSummarySchema } },
    },
    ...accessResponses,
  },
});

/** The 409 of a backup asked for while another is still being sent. */
export function buildBackupAlreadyRunningAnswer(): ErrorAnswerBody {
  return { error: { code: 'BACKUP_ALREADY_RUNNING', message: ptBR.backup.alreadyRunning } };
}

/** The 400 of an includeRecordings that is not "true" or "false". */
export function buildInvalidBackupQueryAnswer(): ErrorAnswerBody {
  return { error: { code: 'INVALID_BACKUP_QUERY', message: ptBR.backup.invalidQuery } };
}

/**
 * The headers of the zip: an attachment named bajaovrlay-AAAA-MM-DD-HHMM.zip, never kept
 * in a cache (each backup is a new moment), and no length, which is known only at the end.
 */
export function buildBackupZipHeaders(fileName: string): Record<string, string> {
  return {
    'content-type': 'application/zip',
    'content-disposition': `attachment; filename="${fileName}"`,
    'cache-control': 'no-store',
  };
}
