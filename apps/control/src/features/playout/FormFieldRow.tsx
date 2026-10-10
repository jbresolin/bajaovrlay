import type { ReactNode } from 'react';

import { Label } from '@/components/ui/label';

/** What ties a control to the message under it, for screen readers and for styling. */
export type ErrorAttributesForControl = {
  'aria-invalid': boolean;
  'aria-describedby': string | undefined;
};

/** The id of the message element under the control with id `controlId`. */
function buildErrorMessageId(controlId: string): string {
  return `${controlId}-error`;
}

/**
 * The attributes a control spreads onto itself so that, when its field has an error, it
 * is marked invalid (red border) and screen readers read the message under it.
 */
export function buildErrorAttributesForControl(
  controlId: string,
  errorMessage: string | undefined,
): ErrorAttributesForControl {
  const hasError = errorMessage !== undefined;
  return {
    'aria-invalid': hasError,
    'aria-describedby': hasError ? buildErrorMessageId(controlId) : undefined,
  };
}

/**
 * One field of a form: its label, the control (passed as children, carrying
 * `id={controlId}`), and the pt-BR error message under it when there is one.
 */
export function FormFieldRow(props: {
  label: string;
  controlId: string;
  errorMessage: string | undefined;
  children: ReactNode;
}) {
  const { label, controlId, errorMessage, children } = props;

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={controlId}>{label}</Label>
      {children}
      {errorMessage !== undefined && (
        <p id={buildErrorMessageId(controlId)} className="text-sm text-destructive">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
