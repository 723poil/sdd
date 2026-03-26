import type { FocusEvent, ReactNode } from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface TooltipSurfaceProps {
  children: ReactNode;
  className?: string;
  side?: 'bottom' | 'top';
  tooltip: string;
}

interface TooltipPosition {
  left: number;
  side: 'bottom' | 'top';
  top: number;
}

const TOOLTIP_GAP = 10;
const VIEWPORT_PADDING = 12;

export function TooltipSurface(props: TooltipSurfaceProps) {
  const { children, className, side = 'top', tooltip } = props;
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<TooltipPosition | null>(null);

  useLayoutEffect(() => {
    if (!isOpen) {
      setPosition(null);
      return;
    }

    const updatePosition = () => {
      const anchorElement = anchorRef.current;
      const tooltipElement = tooltipRef.current;
      if (!anchorElement || !tooltipElement) {
        return;
      }

      const anchorRect = anchorElement.getBoundingClientRect();
      const tooltipRect = tooltipElement.getBoundingClientRect();
      const fitsAbove = anchorRect.top - tooltipRect.height - TOOLTIP_GAP >= VIEWPORT_PADDING;
      const fitsBelow =
        anchorRect.bottom + tooltipRect.height + TOOLTIP_GAP <=
        window.innerHeight - VIEWPORT_PADDING;

      const resolvedSide =
        side === 'top'
          ? fitsAbove || !fitsBelow
            ? 'top'
            : 'bottom'
          : fitsBelow || !fitsAbove
            ? 'bottom'
            : 'top';

      const unclampedLeft = anchorRect.left + anchorRect.width / 2;
      const horizontalPadding = VIEWPORT_PADDING + tooltipRect.width / 2;
      const left = Math.min(
        Math.max(unclampedLeft, horizontalPadding),
        window.innerWidth - horizontalPadding,
      );
      const top =
        resolvedSide === 'top'
          ? anchorRect.top - tooltipRect.height - TOOLTIP_GAP
          : anchorRect.bottom + TOOLTIP_GAP;

      setPosition({
        left,
        side: resolvedSide,
        top: Math.max(top, VIEWPORT_PADDING),
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    document.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      document.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, side, tooltip]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      const tooltipElement = tooltipRef.current;
      const anchorElement = anchorRef.current;
      if (!tooltipElement || !anchorElement) {
        return;
      }

      const tooltipRect = tooltipElement.getBoundingClientRect();
      const anchorRect = anchorElement.getBoundingClientRect();
      const horizontalPadding = VIEWPORT_PADDING + tooltipRect.width / 2;

      setPosition((current) => {
        if (!current) {
          return current;
        }

        const nextLeft = Math.min(
          Math.max(anchorRect.left + anchorRect.width / 2, horizontalPadding),
          window.innerWidth - horizontalPadding,
        );

        return current.left === nextLeft ? current : { ...current, left: nextLeft };
      });
    });

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [isOpen, tooltip]);

  const handleBlur = (event: FocusEvent<HTMLSpanElement>) => {
    if (anchorRef.current?.contains(event.relatedTarget as Node | null)) {
      return;
    }

    setIsOpen(false);
  };

  return (
    <>
      <span
        className={`tooltip-surface${className ? ` ${className}` : ''}`}
        onBlur={handleBlur}
        onFocus={() => {
          setIsOpen(true);
        }}
        onMouseEnter={() => {
          setIsOpen(true);
        }}
        onMouseLeave={() => {
          setIsOpen(false);
        }}
        ref={anchorRef}
      >
        {children}
      </span>
      {isOpen && typeof document !== 'undefined'
        ? createPortal(
            <div
              className={`floating-tooltip floating-tooltip--${position?.side ?? side}`}
              ref={tooltipRef}
              style={{
                left: `${position?.left ?? 0}px`,
                top: `${position?.top ?? 0}px`,
                visibility: position ? 'visible' : 'hidden',
              }}
            >
              <span className="floating-tooltip__bubble">{tooltip}</span>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
