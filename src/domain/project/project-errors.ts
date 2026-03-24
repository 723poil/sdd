import type { AppError } from '@/shared/contracts/app-error';

export type ProjectErrorCode =
  | 'INVALID_PROJECT_PATH'
  | 'PROJECT_NOT_DIRECTORY'
  | 'PROJECT_NOT_READABLE'
  | 'PROJECT_NOT_WRITABLE'
  | 'PROJECT_NOT_INITIALIZED'
  | 'AGENT_CLI_NOT_CONFIGURED'
  | 'AGENT_CLI_NOT_AVAILABLE'
  | 'PROJECT_ANALYSIS_FAILED'
  | 'INVALID_PROJECT_STORAGE';

export function createProjectError(
  code: ProjectErrorCode,
  message: string,
  details?: string,
): AppError {
  const error: AppError = {
    code,
    message,
  };

  if (details !== undefined) {
    error.details = details;
  }

  return error;
}
