import type { KeyboardEvent, Ref } from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * One number box of "Escolher carros" (BAJAOVRLAY-82): a car's box, labelled with its car
 * ("Carro da frente") with the browser's own list of suggestions (the positions' cars,
 * from the box's shared <datalist>), or "Disputa pela posição". Its message shows under
 * it, and the box is described by it. Enter is the caller's: it moves on to what is next.
 */
export function NumberBox({
  ref,
  ...props
}: {
  label: string;
  controlId: string;
  /** The <datalist> of suggestions, for a car's box; undefined for the place. */
  suggestionsListId: string | undefined;
  placeholder: string | undefined;
  numberText: string;
  message: string | undefined;
  isDisabled: boolean;
  /** The number box itself, so Enter in the box before it can move the focus here. */
  ref: Ref<HTMLInputElement>;
  onNumberTextChange: (numberText: string) => void;
  onLeft: () => void;
  onEnterPressed: () => void;
}) {
  const messageId = `${props.controlId}-message`;

  function moveOnWithEnter(keyPress: KeyboardEvent<HTMLInputElement>): void {
    if (keyPress.key !== 'Enter') {
      return;
    }
    // An Enter in a box must never submit or press anything by itself.
    keyPress.preventDefault();
    props.onEnterPressed();
  }

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <Label htmlFor={props.controlId}>{props.label}</Label>
      <Input
        id={props.controlId}
        ref={ref}
        inputMode="numeric"
        autoComplete="off"
        list={props.suggestionsListId}
        placeholder={props.placeholder}
        disabled={props.isDisabled}
        value={props.numberText}
        aria-invalid={props.message === undefined ? undefined : true}
        aria-describedby={props.message === undefined ? undefined : messageId}
        onChange={(change) => props.onNumberTextChange(change.target.value)}
        onBlur={props.onLeft}
        onKeyDown={moveOnWithEnter}
      />
      {props.message === undefined ? null : (
        <p id={messageId} role="alert" className="text-xs text-destructive">
          {props.message}
        </p>
      )}
    </div>
  );
}
