"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full border border-transparent text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-foreground text-background hover:bg-foreground/88",
        outline: "border-border bg-card text-foreground hover:bg-muted",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "text-foreground hover:bg-muted",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/88",
        link: "border-transparent px-0 text-foreground underline-offset-4 hover:underline",
        critical: "bg-[color:var(--color-critical)] text-white hover:opacity-92",
        watch: "bg-[color:var(--color-watch)] text-black hover:opacity-92",
        stable: "bg-[color:var(--color-stable)] text-white hover:opacity-92",
      },
      size: {
        default: "h-10 px-4 py-2 [&_svg:not([class*='size-'])]:size-4",
        xs: "h-6 px-2 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 px-3 text-sm [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-12 px-6 text-sm [&_svg:not([class*='size-'])]:size-4",
        icon: "size-10 [&_svg:not([class*='size-'])]:size-4",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-lg": "size-12 [&_svg:not([class*='size-'])]:size-4",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
