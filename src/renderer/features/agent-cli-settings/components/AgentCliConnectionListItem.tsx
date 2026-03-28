import type {
  AgentCliConnectionRecord,
  AgentCliId,
} from '@/domain/app-settings/agent-cli-connection-model';

import { ConnectionStatusPill } from '@/renderer/features/agent-cli-settings/components/ConnectionStatusPill';
import type { AgentCliConnectionDraft } from '@/renderer/features/agent-cli-settings/types';
import { describeAgentCliConnectionSummary } from '@/renderer/features/agent-cli-settings/utils';

interface AgentCliConnectionListItemProps {
  checkLabel: string;
  checkTone: 'positive' | 'warning' | 'neutral' | 'danger';
  connection: AgentCliConnectionRecord;
  draft: AgentCliConnectionDraft;
  hasPendingChanges: boolean;
  isActive: boolean;
  isChecking: boolean;
  isDefaultAgent: boolean;
  isSaving: boolean;
  onSelect(agentId: AgentCliId): void;
}

export function AgentCliConnectionListItem(props: AgentCliConnectionListItemProps) {
  const saveStateLabel = props.isSaving ? '저장 중' : props.hasPendingChanges ? '저장 필요' : null;
  const saveStateTone = props.isSaving ? 'neutral' : 'warning';
  const checkStateLabel = props.isChecking ? '확인 중' : props.checkLabel;
  const checkStateTone = props.isChecking ? 'neutral' : props.checkTone;

  return (
    <button
      aria-pressed={props.isActive}
      className={`agent-cli-list-item${props.isActive ? ' agent-cli-list-item--active' : ''}`}
      onClick={() => {
        props.onSelect(props.connection.definition.agentId);
      }}
      type="button"
    >
      <div className="agent-cli-list-item__header">
        <div className="agent-cli-list-item__title">
          <strong>{props.connection.definition.displayName}</strong>
          <span>{describeAgentCliConnectionSummary(props.connection, props.draft)}</span>
        </div>
        <div className="agent-cli-list-item__status">
          {props.isDefaultAgent ? <ConnectionStatusPill label="기본" tone="positive" /> : null}
          {saveStateLabel ? (
            <ConnectionStatusPill label={saveStateLabel} tone={saveStateTone} />
          ) : null}
          <ConnectionStatusPill label={checkStateLabel} tone={checkStateTone} />
        </div>
      </div>
    </button>
  );
}
