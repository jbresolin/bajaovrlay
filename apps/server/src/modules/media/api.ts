// The module's routes: POST /api/v1/media (declared here with its schemas and mounted by
// api/v1/createApiV1Routes.ts) and GET /media/<mediaId> (mounted by createServerApp).
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  largestMediaSizeInBytes,
  mediaIdPattern,
  MediaUploadAnswerSchema,
} from '@bajaovrlay/shared';
import { createRoute } from '@hono/zod-openapi';
import type { Context, Hono } from 'hono';

import { type ErrorAnswerBody, ErrorAnswerBodySchema } from '../../core/http/errorAnswers.js';
import type { ServerAppEnvironment } from '../../core/http/httpContextVariables.js';
import { ptBR } from '../../core/messages/ptBR.js';
import type { StateStore } from '../../core/store/createStateStore.js';
import type { UploadedFile } from './mediaUpload.js';

/**
 * The largest body POST /api/v1/media reads before refusing: the 5 MB image plus room
 * for the multipart framing. The image itself is held to exactly 5 MB afterwards.
 */
export const largestMediaUploadBodyInBytes = largestMediaSizeInBytes + 64 * 1024;

/** Every image answer: a year of cache, since a media id never changes content. */
const cacheForAYear = 'public, max-age=31536000, immutable';

/**
 * The policy every image is served with. An SVG can carry script; drawn through <img> it
 * runs none, and opened directly at its URL this policy runs none either: no script, no
 * fetch, a sandboxed document, only inline styles so the drawing still looks right.
 */
export const contentSecurityPolicyOfImages =
  "default-src 'none'; style-src 'unsafe-inline'; sandbox";

const errorAnswerContent = { 'application/json': { schema: ErrorAnswerBodySchema } };

/**
 * `POST /api/v1/media`: one image as multipart form data, in the field "file". The body
 * is described for the OpenAPI document as a plain schema rather than a Zod one, because
 * a File is not JSON; the route reads the form itself and checks the file by its bytes.
 */
export const postMediaRoute = createRoute({
  method: 'post',
  path: '/media',
  summary:
    "Upload one image (PNG, JPEG, WebP or SVG, up to 5 MB) to the media store, from this server's own pages or a tool that sends no Origin",
  request: {
    body: {
      required: true,
      content: {
        'multipart/form-data': {
          schema: {
            type: 'object',
            properties: { file: { type: 'string', format: 'binary' } },
            required: ['file'],
          },
        },
      },
    },
  },
  responses: {
    200: {
      description: 'The media id (the SHA-256 of the file), its type and its size in pixels.',
      content: { 'application/json': { schema: MediaUploadAnswerSchema } },
    },
    400: { description: 'No file in the "file" field (pt-BR).', content: errorAnswerContent },
    403: {
      description: 'Sent by a page of another site: its Origin is not this server (pt-BR).',
      content: errorAnswerContent,
    },
    413: { description: 'The file is over 5 MB (pt-BR).', content: errorAnswerContent },
    415: {
      description: 'The bytes are not a PNG, JPEG, WebP or SVG, whatever the name (pt-BR).',
      content: errorAnswerContent,
    },
    422: {
      description: 'The size of the image cannot be read (pt-BR).',
      content: errorAnswerContent,
    },
    500: {
      description: 'The server could not record the image (pt-BR).',
      content: errorAnswerContent,
    },
    507: {
      description:
        'The store holds 1000 images or 500 MB, or the disk would keep less than 1 GB free (pt-BR).',
      content: errorAnswerContent,
    },
  },
});

/**
 * Reads the uploaded file of a POST /api/v1/media request: the "file" field of the
 * multipart body, its bytes and its name (trimmed, at most 255 characters, "imagem" when
 * the browser sent none). Undefined when there is no file, or the body is not a form.
 */
export async function readUploadedFile(
  context: Context<ServerAppEnvironment>,
): Promise<UploadedFile | undefined> {
  let fileField: unknown;
  try {
    const form = await context.req.parseBody();
    fileField = form['file'];
  } catch {
    // A body that is not multipart at all, or is cut off, carries no file.
    return undefined;
  }
  if (!(fileField instanceof File)) {
    return undefined;
  }
  const fileName = fileField.name.trim().slice(0, 255);
  return {
    bytes: Buffer.from(await fileField.arrayBuffer()),
    fileName: fileName === '' ? 'imagem' : fileName,
  };
}

/** The 400 body of an upload with no file. */
export function buildFileMissingAnswer(): ErrorAnswerBody {
  return { error: { code: 'MEDIA_FILE_MISSING', message: ptBR.mediaErrors.fileMissing } };
}

/** The 403 body of an upload sent by a page of another site. */
export function buildUploadFromAnotherSiteAnswer(): ErrorAnswerBody {
  return {
    error: {
      code: 'MEDIA_UPLOAD_FROM_ANOTHER_SITE',
      message: ptBR.mediaErrors.uploadFromAnotherSite,
    },
  };
}

/** The 413 body of an upload over the limit, when the body itself is too large to read. */
export function buildFileTooLargeAnswer(): ErrorAnswerBody {
  return { error: { code: 'MEDIA_TOO_LARGE', message: ptBR.mediaErrors.fileTooLarge } };
}

/**
 * Serves `/media/<mediaId>`: the image's bytes with the type recorded for it, a year of
 * cache, nosniff and the policy that runs nothing. Path safety: only an id of 64
 * lower-case hexadecimal digits is ever joined to the folder, and only one the media
 * slice lists is read, so no crafted address (`..%2F..%2Fbajaovrlay.sqlite`) and no
 * stray file in the folder can be served. Anything else answers the JSON 404.
 */
export function serveMediaFiles(
  app: Hono<ServerAppEnvironment>,
  dependencies: { stateStore: StateStore; mediaFolder: string },
): void {
  app.get('/media/:mediaId', async (context) => {
    const mediaId = context.req.param('mediaId');
    const notServedBody: ErrorAnswerBody = {
      error: { code: 'MEDIA_NOT_FOUND', message: ptBR.mediaErrors.mediaNotServed },
    };
    if (!mediaIdPattern.test(mediaId)) {
      return context.json(notServedBody, 404);
    }
    const mediaRecord = dependencies.stateStore
      .readAllSlices()
      .media.find((candidate) => candidate.mediaId === mediaId);
    if (mediaRecord === undefined) {
      return context.json(notServedBody, 404);
    }
    let bytes: Buffer;
    try {
      bytes = await readFile(join(dependencies.mediaFolder, mediaId));
    } catch {
      // Listed but not on disk: only a copy of the folder by hand could do that.
      context.get('requestLogger').warn({ media_id: mediaId }, 'listed media has no file');
      return context.json(notServedBody, 404);
    }
    return context.body(new Uint8Array(bytes), 200, {
      'Content-Type': mediaRecord.contentType,
      'Cache-Control': cacheForAYear,
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': contentSecurityPolicyOfImages,
    });
  });
}
