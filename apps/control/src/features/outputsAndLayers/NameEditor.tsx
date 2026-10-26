import { useState } from 'react';

import { Input } from '@/components/ui/input';
import { ActionButton } from '@/features/connection/ActionButton';

/** What the editor needs: the name the server holds, its label, its button, and the save. */
export type NameEditorProps = {
  currentName: string;
  fieldLabel: string;
  saveButtonText: string;
  /** Called with the new name, trimmed, when the button is pressed. */
  onSave: (newName: string) => void;
  inputClassName?: string;
};

/**
 * A name field with its save button, off until the typed name differs from the server's
 * and is not blank. Draw it with `key={currentName}`: when the server's name changes
 * (this page saved it, or another operator did) the editor starts again from it and drops
 * what was typed, so the field never shows a name the server does not hold.
 */
export function NameEditor(props: NameEditorProps) {
  const [nameDraft, setNameDraft] = useState(props.currentName);
  const trimmedDraft = nameDraft.trim();
  const isNameChanged = trimmedDraft !== '' && trimmedDraft !== props.currentName;

  return (
    <div className="flex items-center gap-2">
      <Input
        aria-label={props.fieldLabel}
        value={nameDraft}
        className={props.inputClassName ?? 'h-8 w-40'}
        onChange={(change) => setNameDraft(change.target.value)}
      />
      <ActionButton
        size="xs"
        variant="secondary"
        disabled={!isNameChanged}
        onClick={() => props.onSave(trimmedDraft)}
      >
        {props.saveButtonText}
      </ActionButton>
    </div>
  );
}
