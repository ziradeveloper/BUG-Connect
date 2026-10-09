import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Right-pane placeholder shown when no conversation is selected. */
@Component({
  selector: 'app-inbox-empty',
  standalone: true,
  templateUrl: './inbox-empty.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InboxEmptyComponent {}
