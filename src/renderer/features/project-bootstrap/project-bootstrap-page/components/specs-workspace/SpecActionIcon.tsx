import type { SVGProps } from 'react';

type SpecActionIconName =
  | 'add'
  | 'apply'
  | 'archive'
  | 'back'
  | 'cancel'
  | 'compare'
  | 'copy'
  | 'delete'
  | 'diff'
  | 'edit'
  | 'history'
  | 'list'
  | 'open'
  | 'preview'
  | 'relations'
  | 'restore'
  | 'save'
  | 'split'
  | 'write';

interface SpecActionIconProps {
  name: SpecActionIconName;
}

export function SpecActionIcon(props: SpecActionIconProps) {
  const { name } = props;

  switch (name) {
    case 'add':
      return (
        <IconSvg>
          <path d="M10 4.5v11M4.5 10h11" />
        </IconSvg>
      );
    case 'apply':
      return (
        <IconSvg>
          <path d="M13.8 6.2H8.4A2.9 2.9 0 0 0 5.5 9v6.5" />
          <path d="M5.5 13.4 3.7 15.5l1.8 2.1" />
          <path d="M12 4.5h3.5v3.5" />
        </IconSvg>
      );
    case 'archive':
      return (
        <IconSvg>
          <path d="M4.5 5.5h11l-1 2.7H5.5l-1-2.7Z" />
          <path d="M6 8.2v5.8A1.5 1.5 0 0 0 7.5 15.5h5A1.5 1.5 0 0 0 14 14V8.2" />
          <path d="M8 10.2h4" />
        </IconSvg>
      );
    case 'back':
      return (
        <IconSvg>
          <path d="M11.5 4.5 6 10l5.5 5.5" />
          <path d="M7 10h7" />
        </IconSvg>
      );
    case 'cancel':
      return (
        <IconSvg>
          <path d="m5.3 5.3 9.4 9.4M14.7 5.3l-9.4 9.4" />
        </IconSvg>
      );
    case 'compare':
      return (
        <IconSvg>
          <path d="M4.5 6.2h6M4.5 10h11M9.5 13.8h6" />
          <path d="m9.6 4.6 1.8 1.6-1.8 1.6M10.4 12.2l-1.8 1.6 1.8 1.6" />
        </IconSvg>
      );
    case 'copy':
      return (
        <IconSvg>
          <path d="M7 6.2h6.8A1.5 1.5 0 0 1 15.3 7.7v7A1.5 1.5 0 0 1 13.8 16.2H7A1.5 1.5 0 0 1 5.5 14.7v-7A1.5 1.5 0 0 1 7 6.2Z" />
          <path d="M12.8 6.2V5.3A1.5 1.5 0 0 0 11.3 3.8H6.2a1.5 1.5 0 0 0-1.5 1.5v6" />
        </IconSvg>
      );
    case 'delete':
      return (
        <IconSvg>
          <path d="M5.8 6.2h8.4" />
          <path d="M8 6.2V4.9a.9.9 0 0 1 .9-.9h2.2a.9.9 0 0 1 .9.9v1.3" />
          <path d="M6.7 6.2l.6 8a1.3 1.3 0 0 0 1.3 1.2h2.8a1.3 1.3 0 0 0 1.3-1.2l.6-8" />
          <path d="M8.8 8.8v4.1M11.2 8.8v4.1" />
        </IconSvg>
      );
    case 'diff':
      return (
        <IconSvg>
          <path d="M6.2 4.8v10.4M13.8 4.8v10.4" />
          <path d="M8.4 6.6h3.2M8.4 10h3.2M8.4 13.4h3.2" />
        </IconSvg>
      );
    case 'edit':
      return (
        <IconSvg>
          <path d="m6 14.2-1.2 1.3.4-1.8L12.7 6.2a1.4 1.4 0 1 1 2 2L7.2 15.7l-1.2.3Z" />
          <path d="m11.8 7 2.2 2.2" />
        </IconSvg>
      );
    case 'history':
      return (
        <IconSvg>
          <path d="M5.2 6.6A5.4 5.4 0 1 1 4.7 12" />
          <path d="M5.2 3.8v2.8H8" />
          <path d="M10 7v3.1l2.2 1.4" />
        </IconSvg>
      );
    case 'list':
      return (
        <IconSvg>
          <path d="M7.5 6h7M7.5 10h7M7.5 14h7" />
          <path d="M4.8 6h.01M4.8 10h.01M4.8 14h.01" />
        </IconSvg>
      );
    case 'open':
      return (
        <IconSvg>
          <path d="M7 13 13 7" />
          <path d="M9.6 7H13v3.4" />
          <path d="M12.2 10.6v3a1.2 1.2 0 0 1-1.2 1.2H6.4a1.2 1.2 0 0 1-1.2-1.2V9a1.2 1.2 0 0 1 1.2-1.2h3" />
        </IconSvg>
      );
    case 'preview':
      return (
        <IconSvg>
          <path d="M2.8 10s2.8-4.4 7.2-4.4S17.2 10 17.2 10s-2.8 4.4-7.2 4.4S2.8 10 2.8 10Z" />
          <path d="M10 8.1A1.9 1.9 0 1 1 8.1 10 1.9 1.9 0 0 1 10 8.1Z" />
        </IconSvg>
      );
    case 'relations':
      return (
        <IconSvg>
          <path d="M7 7.5 9 9.5M11 10.5l2 2" />
          <path d="M6.2 10.1 4.8 8.7a2.1 2.1 0 1 1 3-3l1.4 1.4" />
          <path d="m13.8 9.9 1.4 1.4a2.1 2.1 0 0 1-3 3l-1.4-1.4" />
        </IconSvg>
      );
    case 'restore':
      return (
        <IconSvg>
          <path d="M4.5 5.5h11l-1 2.7H5.5l-1-2.7Z" />
          <path d="M6 8.2v5.8A1.5 1.5 0 0 0 7.5 15.5h5A1.5 1.5 0 0 0 14 14V8.2" />
          <path d="M10 12.5V9.2" />
          <path d="m8.6 10.5 1.4-1.4 1.4 1.4" />
        </IconSvg>
      );
    case 'save':
      return (
        <IconSvg>
          <path d="m4.8 10.1 3.2 3.2 7-7" />
        </IconSvg>
      );
    case 'split':
      return (
        <IconSvg>
          <path d="M4.8 5.2h10.4v9.6H4.8z" />
          <path d="M10 5.2v9.6" />
        </IconSvg>
      );
    case 'write':
      return (
        <IconSvg>
          <path d="M5.5 5.2h9M5.5 9h6.2M5.5 12.8h4" />
          <path d="m11.2 14.8 1.1-3.1 2.7-2.7a1.1 1.1 0 1 1 1.6 1.6l-2.7 2.7-2.7 1.5Z" />
        </IconSvg>
      );
  }
}

function IconSvg(props: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" {...props}>
      <g
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      >
        {props.children}
      </g>
    </svg>
  );
}
