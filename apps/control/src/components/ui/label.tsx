// shadcn/ui component "label" (style new-york-v4), written in by hand and kept close to
// the original so later shadcn updates diff cleanly. Local change: `cn` comes from the
// cn package.
import { cn } from 'cn';
import { Label as LabelPrimitive } from 'radix-ui';
import * as React from 'react';

/** The shadcn/ui label: names a form control; `htmlFor` ties it to the control's id. */
function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        'flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

export { Label };
