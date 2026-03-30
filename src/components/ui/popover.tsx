"use client";

import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { cn } from "@/lib/utils";

function Popover({ ...props }: PopoverPrimitive.Root.Props) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

function PopoverTrigger({ ...props }: PopoverPrimitive.Trigger.Props) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

function PopoverTitle({ className, ...props }: PopoverPrimitive.Title.Props) {
  return (
    <PopoverPrimitive.Title
      data-slot="popover-title"
      className={cn("text-sm font-medium text-foreground", className)}
      {...props}
    />
  );
}

function PopoverDescription({
  className,
  ...props
}: PopoverPrimitive.Description.Props) {
  return (
    <PopoverPrimitive.Description
      data-slot="popover-description"
      className={cn("text-sm leading-6 text-muted-foreground", className)}
      {...props}
    />
  );
}

function PopoverContent({
  align = "end",
  alignOffset = 0,
  className,
  side = "top",
  sideOffset = 10,
  children,
  ...props
}: PopoverPrimitive.Popup.Props &
  Pick<
    PopoverPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset"
  >) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        className="z-50"
        side={side}
        sideOffset={sideOffset}
      >
        <PopoverPrimitive.Popup
          data-slot="popover-content"
          className={cn(
            "z-50 flex w-80 max-w-[calc(100vw-2rem)] origin-(--transform-origin) flex-col gap-2 rounded-2xl border border-border/80 bg-popover p-4 text-popover-foreground shadow-lg outline-none data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
            className,
          )}
          {...props}
        >
          {children}
          <PopoverPrimitive.Arrow className="z-50 size-3 rounded-[2px] border-border/80 bg-popover data-[side=bottom]:-top-[0.4rem] data-[side=bottom]:rotate-45 data-[side=bottom]:border-r data-[side=bottom]:border-b data-[side=left]:-right-[0.4rem] data-[side=left]:top-1/2 data-[side=left]:-translate-y-1/2 data-[side=left]:-rotate-45 data-[side=left]:border-b data-[side=left]:border-l data-[side=right]:-left-[0.4rem] data-[side=right]:top-1/2 data-[side=right]:-translate-y-1/2 data-[side=right]:rotate-[225deg] data-[side=right]:border-t data-[side=right]:border-r data-[side=top]:-bottom-[0.4rem] data-[side=top]:rotate-[225deg] data-[side=top]:border-t data-[side=top]:border-l" />
        </PopoverPrimitive.Popup>
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  );
}

export {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
};
