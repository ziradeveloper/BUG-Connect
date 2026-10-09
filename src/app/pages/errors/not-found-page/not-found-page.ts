import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { WorkspaceContext } from '../../../core/workspace/workspace-context';
import { PageHeader } from '../../../shared/ui/page-header/page-header';
import { PlannedState } from '../../../shared/ui/planned-state/planned-state';

@Component({
  selector: 'app-not-found-page',
  imports: [PageHeader, PlannedState],
  templateUrl: './not-found-page.html',
  styleUrl: './not-found-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFoundPage {
  private readonly workspace = inject(WorkspaceContext);

  protected readonly host = computed(() => this.workspace.resolved().host || 'unknown host');
}
