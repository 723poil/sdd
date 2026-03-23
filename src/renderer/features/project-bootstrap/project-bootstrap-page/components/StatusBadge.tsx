import type { StatusBadgeModel } from '@/renderer/features/project-bootstrap/project-bootstrap-page/project-bootstrap-page.types';

export function StatusBadge(props: StatusBadgeModel) {
  return <span className={`status-badge status-badge--${props.tone}`}>{props.label}</span>;
}
