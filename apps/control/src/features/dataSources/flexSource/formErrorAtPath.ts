import { type FieldErrors, get } from 'react-hook-form';

/**
 * Reads the message of the error at a nested field path of the flex form
 * ("requests.0.headers.1.valueText"), or undefined when the field has none. The flex form
 * nests lists in lists, so its controls name their field by path rather than by key.
 */
export function readErrorMessageAtPath(errors: FieldErrors, fieldPath: string): string | undefined {
  const errorAtPath: unknown = get(errors, fieldPath);
  const hasAMessage =
    typeof errorAtPath === 'object' &&
    errorAtPath !== null &&
    'message' in errorAtPath &&
    typeof errorAtPath.message === 'string';
  return hasAMessage ? (errorAtPath.message as string) : undefined;
}
