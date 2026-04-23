import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "./utils";

const buttonVariants = cva(
	"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50",
	{
		variants: {
			variant: {
				default:
					"bg-[color:var(--interactive-accent)] text-[color:var(--text-on-accent)] hover:bg-[color:var(--interactive-accent-hover)]",
				secondary:
					"bg-[color:var(--background-modifier-hover)] text-text-normal hover:bg-[color:var(--background-modifier-border)]",
				ghost: "hover:bg-[color:var(--background-modifier-hover)] text-text-normal",
				outline:
					"border border-bg-modifier bg-transparent hover:bg-[color:var(--background-modifier-hover)] text-text-normal",
				destructive:
					"bg-[color:var(--color-red)] text-white hover:opacity-90",
			},
			size: {
				default: "h-9 px-4 py-2",
				sm: "h-8 px-3 text-xs",
				lg: "h-10 px-6",
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
	extends ButtonHTMLAttributes<HTMLButtonElement>,
		VariantProps<typeof buttonVariants> {
	asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
	({ className, variant, size, asChild = false, ...props }, ref) => {
		const Comp = asChild ? Slot : "button";
		return (
			<Comp
				ref={ref}
				className={cn(buttonVariants({ variant, size, className }))}
				{...props}
			/>
		);
	},
);
Button.displayName = "Button";
