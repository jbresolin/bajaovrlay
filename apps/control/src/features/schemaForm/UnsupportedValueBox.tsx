import { Label } from '@/components/ui/label';

/**
 * The read-only box for data the form cannot edit yet (a list, a nested object, a
 * `oneOf`, or a whole schema that is not an object with properties): a label, a pt-BR
 * note saying it is only for reading, and the value as JSON text when there is one.
 * A plain <textarea readOnly> on purpose: the page has no shadcn/ui textarea, and
 * nothing typed here could ever be sent, so the box must not look editable.
 */
export function UnsupportedValueBox(props: {
  /** The element id of the box, which its label points at while there is a box. */
  controlId: string;
  label: string;
  /** The note above the box; the caller picks the wording for "has a value" or "has none". */
  note: string;
  /** The value as JSON text, or undefined when there is none: no box is drawn then. */
  jsonText: string | undefined;
}) {
  const { controlId, label, note, jsonText } = props;
  const noteId = `${controlId}-note`;

  return (
    <div className="flex flex-col gap-2">
      {/* Without a value there is no box, so the label is left pointing at nothing
          instead of naming an element id that is not on the page. */}
      <Label htmlFor={jsonText === undefined ? undefined : controlId}>{label}</Label>
      <p id={noteId} className="text-xs text-muted-foreground">
        {note}
      </p>
      {jsonText !== undefined && (
        <textarea
          id={controlId}
          readOnly
          rows={4}
          value={jsonText}
          aria-describedby={noteId}
          className="w-full rounded-md border border-input bg-muted px-3 py-2 font-mono text-xs text-muted-foreground"
        />
      )}
    </div>
  );
}
