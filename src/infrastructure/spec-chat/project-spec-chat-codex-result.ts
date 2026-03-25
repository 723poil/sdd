import { createProjectError } from '@/domain/project/project-errors';
import { err, ok, type Result } from '@/shared/contracts/result';

interface ProjectSpecChatReplyResult {
  markdown: string;
  reply: string;
  summary: string | null;
  title: string;
}

export function parseProjectSpecChatCodexResult(raw: string): Result<ProjectSpecChatReplyResult> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw) as unknown;
  } catch (error) {
    return err(
      createProjectError(
        'PROJECT_SPEC_CHAT_FAILED',
        '에이전트 응답을 JSON으로 해석하지 못했습니다.',
        error instanceof Error ? error.message : undefined,
      ),
    );
  }

  if (!parsed || typeof parsed !== 'object') {
    return err(
      createProjectError('PROJECT_SPEC_CHAT_FAILED', '에이전트 응답 형식이 올바르지 않습니다.'),
    );
  }

  const candidate = parsed as Record<string, unknown>;
  if (
    typeof candidate.reply !== 'string' ||
    typeof candidate.title !== 'string' ||
    typeof candidate.summary !== 'string' ||
    typeof candidate.markdown !== 'string'
  ) {
    return err(
      createProjectError(
        'PROJECT_SPEC_CHAT_FAILED',
        '에이전트 응답에 필요한 명세 초안 필드가 없습니다.',
      ),
    );
  }

  return ok({
    markdown: candidate.markdown,
    reply: candidate.reply,
    summary: candidate.summary.trim() || null,
    title: candidate.title,
  });
}
