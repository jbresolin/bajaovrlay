// shadcn/ui component "popover" (style new-york-v4), written in by hand and kept close to
// the original so later shadcn updates diff cleanly. Local changes: `cn` comes from the cn
// package; the anchor part is kept (shadcn leaves it out), because "Escolher carros"
// (BAJAOVRLAY-82) places its box under a whole quick-fire button or rundown row, not under
// the small chevron that opens it. The `animate-in`/`fade-in` classes belong to
// tw-animate-css, which is not installed: without it they do nothing.
import { cn } from 'cn';
import { Popover as PopoverPrimitive } from 'radix-ui';
import * as React from 'react';

/** The shadcn/ui popover: a small box beside an element (`open`, `onOpenChange`). */
function Popover({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

/** The control that opens and closes the box. */
function PopoverTrigger({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

/** The element the box is placed against, when it is not the trigger itself. */
function PopoverAnchor({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Anchor>) {
  return <PopoverPrimitive.Anchor data-slot="popover-anchor" {...props} />;
}

/** The box, drawn at the end of the page above everything. */
function PopoverContent({
  className,
  align = 'center',
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-50 w-72 origin-(--radix-popover-content-transform-origin) rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-hidden data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}

export { Popover, PopoverAnchor, PopoverContent, PopoverTrigger };
