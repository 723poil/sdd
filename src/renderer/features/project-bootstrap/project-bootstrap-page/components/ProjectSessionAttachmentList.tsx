export interface ProjectSessionAttachmentListItem {
  id: string;
  kind: 'image' | 'file';
  mimeType: string;
  name: string;
  previewUrl?: string | null;
  sizeBytes: number;
}

interface ProjectSessionAttachmentListProps {
  attachments: readonly ProjectSessionAttachmentListItem[];
  onRemove?: (attachmentId: string) => void;
  variant: 'composer' | 'message';
}

export function ProjectSessionAttachmentList(props: ProjectSessionAttachmentListProps) {
  if (props.attachments.length === 0) {
    return null;
  }

  if (props.variant === 'composer') {
    return (
      <div className="info-sidebar-chat-composer__attachments">
        {props.attachments.map((attachment) => (
          <div className="info-sidebar-chat-composer__attachment" key={attachment.id}>
            {attachment.kind === 'image' && attachment.previewUrl ? (
              <img
                alt={attachment.name}
                className="info-sidebar-chat-composer__attachment-thumbnail"
                loading="lazy"
                src={attachment.previewUrl}
              />
            ) : (
              <span className="info-sidebar-chat-composer__attachment-icon">
                {resolveAttachmentLabel(attachment)}
              </span>
            )}
            <div className="info-sidebar-chat-composer__attachment-label">
              <strong title={attachment.name}>{attachment.name}</strong>
              <span>{formatAttachmentMeta(attachment)}</span>
            </div>
            {props.onRemove ? (
              <button
                aria-label={`${attachment.name} 첨부 제거`}
                className="info-sidebar-chat-composer__attachment-remove"
                onClick={() => {
                  props.onRemove?.(attachment.id);
                }}
                type="button"
              >
                <span aria-hidden="true">×</span>
              </button>
            ) : null}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="info-sidebar-chat-message__attachments">
      {props.attachments.map((attachment) => (
        attachment.kind === 'image' && attachment.previewUrl ? (
          <figure
            className="info-sidebar-chat-message__attachment info-sidebar-chat-message__attachment--image"
            key={attachment.id}
          >
            <img
              alt={attachment.name}
              className="info-sidebar-chat-message__attachment-thumbnail"
              loading="lazy"
              src={attachment.previewUrl}
            />
            <figcaption>{formatAttachmentMeta(attachment)}</figcaption>
          </figure>
        ) : (
          <div className="info-sidebar-chat-message__attachment" key={attachment.id}>
            <strong title={attachment.name}>{attachment.name}</strong>
            <span>{formatAttachmentMeta(attachment)}</span>
          </div>
        )
      ))}
    </div>
  );
}

function resolveAttachmentLabel(attachment: ProjectSessionAttachmentListItem): string {
  if (attachment.kind === 'image') {
    return '이미지';
  }

  const extension = getAttachmentExtension(attachment.name);
  return extension.length > 0 ? extension.toUpperCase() : '파일';
}

function formatAttachmentMeta(attachment: ProjectSessionAttachmentListItem): string {
  const label = resolveAttachmentLabel(attachment);
  return `${label} · ${formatAttachmentSize(attachment.sizeBytes)}`;
}

function formatAttachmentSize(sizeBytes: number): string {
  if (sizeBytes >= 1024 * 1024) {
    return `${(sizeBytes / (1024 * 1024)).toFixed(1)}MB`;
  }

  if (sizeBytes >= 1024) {
    return `${Math.round(sizeBytes / 1024)}KB`;
  }

  return `${sizeBytes}B`;
}

function getAttachmentExtension(name: string): string {
  const trimmedName = name.trim();
  const lastDotIndex = trimmedName.lastIndexOf('.');
  if (lastDotIndex <= 0 || lastDotIndex === trimmedName.length - 1) {
    return '';
  }

  return trimmedName.slice(lastDotIndex + 1);
}
