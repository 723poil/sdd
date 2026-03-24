interface ConnectionStatusPillProps {
  label: string;
  tone: 'positive' | 'warning' | 'neutral' | 'danger';
}

export function ConnectionStatusPill(props: ConnectionStatusPillProps) {
  return <span className={`connection-status-pill connection-status-pill--${props.tone}`}>{props.label}</span>;
}
