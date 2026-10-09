import { Component, input, output } from '@angular/core';

/** Destructive-action gate. Reused by delete on users, roles and clients. */
@Component({
  selector: 'app-confirm-dialog',
  templateUrl: './confirm-dialog.html',
})
export class ConfirmDialog {
  readonly open = input(false);
  readonly title = input.required<string>();
  readonly description = input('');
  readonly confirmLabel = input('Confirm');
  readonly cancel = output<void>();
  readonly confirm = output<void>();
}
