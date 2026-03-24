import { createProjectBootstrapWorkbenchViewModel } from '@/renderer/features/project-bootstrap/project-bootstrap-page/project-bootstrap-workbench-view-model';
import { useProjectBootstrapWorkbenchWorkflow } from '@/renderer/features/project-bootstrap/project-bootstrap-page/use-project-bootstrap-workbench.workflow';

export function useProjectBootstrapWorkbench() {
  const workflow = useProjectBootstrapWorkbenchWorkflow();
  const viewModel = createProjectBootstrapWorkbenchViewModel(workflow.state);

  return {
    ...workflow.state,
    ...viewModel,
    ...workflow.actions,
  };
}
