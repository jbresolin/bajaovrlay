/**
 * Six dots in two columns, the usual sign for "drag here". Drawn inline, like the icons
 * of the shadcn Select, instead of adding an icon package (docs/decisions.md, PR #5).
 * Shared by the rundown's rows and the layer rows of "Saídas e camadas".
 */
export function DragHandleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4" fill="currentColor">
      <circle cx="5" cy="3" r="1.5" />
      <circle cx="11" cy="3" r="1.5" />
      <circle cx="5" cy="8" r="1.5" />
      <circle cx="11" cy="8" r="1.5" />
      <circle cx="5" cy="13" r="1.5" />
      <circle cx="11" cy="13" r="1.5" />
    </svg>
  );
}
