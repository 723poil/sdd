import type { ProjectDialogPort } from '@/application/project/project.ports';
import type { Result } from '@/shared/contracts/result';

export interface SelectProjectDirectoryOutput {
  didSelect: boolean;
  rootPath: string | null;
}

export interface SelectProjectDirectoryUseCase {
  execute(): Promise<Result<SelectProjectDirectoryOutput>>;
}

export function createSelectProjectDirectoryUseCase(
  dependencies: { projectDialog: ProjectDialogPort },
): SelectProjectDirectoryUseCase {
  return {
    async execute() {
      const selectionResult = await dependencies.projectDialog.openProjectDirectory();
      if (!selectionResult.ok) {
        return selectionResult;
      }

      return {
        ok: true,
        value: {
          didSelect: selectionResult.value !== null,
          rootPath: selectionResult.value,
        },
      };
    },
  };
}
