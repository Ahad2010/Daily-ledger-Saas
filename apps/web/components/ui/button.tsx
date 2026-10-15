import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { ButtonHTMLAttributes } from 'react';
const styles=cva('button',{variants:{variant:{default:'',primary:'primary',ghost:'ghost',danger:'danger'}},defaultVariants:{variant:'default'}});
export function Button({className,variant,asChild=false,loading=false,children,...props}:ButtonHTMLAttributes<HTMLButtonElement>&VariantProps<typeof styles>&{asChild?:boolean;loading?:boolean}){const Comp=asChild?Slot:'button';
 // While a save is in flight the button shows the same sweeping loading line as the app preloader, so slow connections never look frozen.
 if(asChild)return <Comp className={twMerge(clsx(styles({variant}),className))} {...props}>{children}</Comp>;
 return <Comp className={twMerge(clsx(styles({variant}),loading&&'is-loading',className))} aria-busy={loading||undefined} {...props}>{children}{loading&&<span className="button-line" aria-hidden="true"/>}</Comp>;}
