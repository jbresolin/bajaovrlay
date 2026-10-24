/**
 * Whether an optional text field of a graphic has something to show. Several graphics draw
 * a part only when its text is given (the notice's team, the lower third's role, the team
 * card's city), and all must agree on what "given" means.
 */

/**
 * Answers whether a text field has something to show. A text of blanks counts as
 * missing: an operator who cleared a field by typing spaces, or a record or an event with
 * an empty value, must not leave an empty box or a dangling dot on air.
 */
export function isTextGiven(text: string | undefined): text is string {
  return text !== undefined && text.trim() !== '';
}
