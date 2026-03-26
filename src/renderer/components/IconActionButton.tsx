import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { TooltipSurface } from '@/renderer/components/TooltipSurface';

type IconActionButtonTone = 'danger' | 'default' | 'primary';
type IconActionButtonSize = 'default' | 'small';

interface IconActionButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label' | 'children'> {
  icon: ReactNode;
  isActive?: boolean;
  label: string;
  size?: IconActionButtonSize;
  tone?: IconActionButtonTone;
  tooltipSide?: 'bottom' | 'top';
}

export function IconActionButton(props: IconActionButtonProps) {
  const {
    className,
    icon,
    isActive = false,
    label,
    size = 'default',
    tone = 'default',
    tooltipSide = 'top',
    type = 'button',
    ...buttonProps
  } = props;

  const classes = [
    'icon-action-button',
    `icon-action-button--${tone}`,
    `icon-action-button--${size}`,
    isActive ? 'icon-action-button--active' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <TooltipSurface side={tooltipSide} tooltip={label}>
      <button {...buttonProps} aria-label={label} className={classes} type={type}>
        {icon}
      </button>
    </TooltipSurface>
  );
}
