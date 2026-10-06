import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// Sistema "Classical": el primario es outline (borde ocre de 1px, fondo
// transparente) y nunca va relleno; el secundario lleva filete; el ghost es
// solo texto. La tipografía de los botones es la de títulos (Cormorant 600).
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md border font-display text-[15px] font-semibold leading-none cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:pointer-events-none disabled:opacity-45 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "border-brand bg-transparent text-brand-700 hover:bg-brand/12 active:bg-brand/22",
        destructive:
          "border-destructive bg-transparent text-destructive hover:bg-destructive/10 active:bg-destructive/18",
        outline:
          "border-border bg-transparent text-foreground hover:bg-foreground/7 active:bg-foreground/14",
        secondary:
          "border-border bg-transparent text-foreground hover:bg-foreground/7 active:bg-foreground/14",
        ghost: "border-transparent text-foreground hover:bg-accent hover:text-accent-foreground",
        link: "h-auto border-transparent px-0 text-brand-700 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3 text-sm",
        lg: "h-11 px-6 text-base",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
