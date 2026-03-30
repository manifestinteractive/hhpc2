import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit items-center justify-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.65rem] font-medium uppercase tracking-[0.16em] whitespace-nowrap [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
  {
    variants: {
      variant: {
        default: "border-border bg-foreground text-background",
        secondary: "border-border bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-destructive text-destructive-foreground",
        outline: "border-border bg-background text-foreground",
        ghost: "border-transparent bg-transparent text-foreground",
        link: "border-transparent bg-transparent px-0 text-foreground underline-offset-4 hover:underline",
        critical: "border-transparent bg-[color:var(--color-critical)] text-white",
        watch: "border-transparent bg-[color:var(--color-watch)] text-black",
        stable: "border-transparent bg-[color:var(--color-stable)] text-white",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
