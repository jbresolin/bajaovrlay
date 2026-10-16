// shadcn/ui component "dialog" (style new-york-v4), written in by hand and kept close to
// the original so later shadcn updates diff cleanly. Local changes: `cn` comes from the
// cn package; the close button's cross is an inline SVG instead of lucide-react's XIcon;
// its hidden text ("Close" in shadcn) is a required prop, so the pt-BR catalog supplies it;
// the parts this app does not use (trigger, footer, the separate close part) are left out.
// The `animate-in`/`fade-in` classes belong to tw-animate-css, which is not installed:
// without it they do nothing and the dialog simply appears.
import { cn } from 'cn';
import { Dialog as DialogPrimitive } from 'radix-ui';
import * as React from 'react';

/** The shadcn/ui dialog: a box over the page (`open`, `onOpenChange`). */
function Dialog({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

/** The dimmed layer behind the box. */
function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        'fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0',
        className,
      )}
      {...props}
    />
  );
}

/**
 * The box itself, drawn at the end of the page above everything, with a cross in its
 * corner that closes it. `closeButtonLabel` is what a screen reader reads for the cross.
 */
function DialogContent({
  className,
  children,
  closeButtonLabel,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { closeButtonLabel: string }) {
  return (
    <DialogPrimitive.Portal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          'fixed top-[50%] left-[50%] z-50 grid max-h-[85vh] w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 overflow-y-auto rounded-lg border bg-background p-6 shadow-lg duration-200 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 sm:max-w-lg',
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute top-4 right-4 rounded-xs opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
          <CrossIcon />
          <span className="sr-only">{closeButtonLabel}</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

/** The title and the line under it. */
function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-header"
      className={cn('flex flex-col gap-2 text-center sm:text-left', className)}
      {...props}
    />
  );
}

/** The dialog's title, which is also its accessible name. */
function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn('text-lg leading-none font-semibold', className)}
      {...props}
    />
  );
}

/** The line under the title, read out with it. */
function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  );
}

/** A cross, the usual sign for "close". */
function CrossIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

export { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle };
