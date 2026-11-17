import type { ComponentProps, ReactNode } from 'react';
import { Link } from 'react-router';
import type { LucideIcon } from 'lucide-react';
import { cx } from '../../lib/cx';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

const base =
  'inline-flex items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap transition-colors ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

const variants: Record<Variant, string> = {
  primary: 'bg-brand-700 text-white shadow-sm hover:bg-brand-800 focus-visible:outline-brand-600',
  secondary:
    'bg-white text-slate-700 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus-visible:outline-brand-600',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-brand-600',
  danger: 'bg-red-700 text-white shadow-sm hover:bg-red-800 focus-visible:outline-red-600',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
};

const iconOnlySizes: Record<Size, string> = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
};

interface StyleProps {
  variant?: Variant | undefined;
  size?: Size | undefined;
  icon?: LucideIcon | undefined;
  /** Renders a square button; `aria-label` is then required for an accessible name. */
  iconOnly?: boolean | undefined;
}

function buttonClasses({ variant = 'secondary', size = 'md', iconOnly }: StyleProps, className?: string) {
  return cx(base, variants[variant], iconOnly ? iconOnlySizes[size] : sizes[size], className);
}

function Content({ icon: Icon, iconOnly, children }: Pick<StyleProps, 'icon' | 'iconOnly'> & { children?: ReactNode }) {
  return (
    <>
      {Icon && <Icon aria-hidden="true" className={iconOnly ? 'h-4 w-4' : 'h-4 w-4 -ml-0.5'} />}
      {children}
    </>
  );
}

export type ButtonProps = ComponentProps<'button'> & StyleProps;

export function Button({ variant, size, icon, iconOnly, className, children, type = 'button', ...rest }: ButtonProps) {
  return (
    <button type={type} className={buttonClasses({ variant, size, iconOnly }, className)} {...rest}>
      <Content icon={icon} iconOnly={iconOnly}>
        {children}
      </Content>
    </button>
  );
}

export type ButtonLinkProps = ComponentProps<typeof Link> & StyleProps;

/** A navigation link styled as a button. */
export function ButtonLink({ variant, size, icon, iconOnly, className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={buttonClasses({ variant, size, iconOnly }, className)} {...rest}>
      <Content icon={icon} iconOnly={iconOnly}>
        {children as ReactNode}
      </Content>
    </Link>
  );
}
