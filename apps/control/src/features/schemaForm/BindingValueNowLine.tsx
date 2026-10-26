import type { BindingFieldValue } from '@bajaovrlay/shared';
import { useSyncExternalStore } from 'react';

import { describeBindingValueNow } from './bindingValueNowText';
import type { SchemaFormBindingOptions } from './schemaFormBindingOptions';

/**
 * The "Valor agora" line under a field set to "Fonte": what the field would get if the
 * item were taken now. It is the one part of a bound field that follows the race, so it
 * listens to the panel's values on its own (BAJAOVRLAY-45): a poll redraws this line,
 * and only when its text changes; the field's controls are not drawn again.
 */
export function BindingValueNowLine(props: {
  binding: BindingFieldValue;
  bindingOptions: SchemaFormBindingOptions;
}) {
  const { binding, bindingOptions } = props;

  // useSyncExternalStore is React's way to read something kept outside React. After every
  // change it is told of, React calls the reader below and redraws this line only when the
  // text it gives differs from the last one. A text, not the resolution: a resolution is
  // a new object at every read, so every poll would count as a change.
  const valueNowText = useSyncExternalStore(bindingOptions.subscribeToValuesNow, () =>
    describeBindingValueNow(bindingOptions.readValueNow(binding), binding),
  );

  return <p className="text-xs text-muted-foreground">{valueNowText}</p>;
}
