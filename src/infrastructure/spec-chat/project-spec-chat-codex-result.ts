import { createProjectError } from '@/domain/project/project-errors';
import { err, ok, type Result } from '@/shared/contracts/result';

interface ProjectSpecChatReplyResult {
  reply: string;
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
  if (typeof candidate.reply !== 'string') {
    return err(
      createProjectError('PROJECT_SPEC_CHAT_FAILED', '에이전트 응답에 reply 필드가 없습니다.'),
    );
  }

  return ok({
    reply: candidate.reply,
  });
}
