import { Component, input } from '@angular/core';

/** Status text with a tone, so every list reads the same way. */
@Component({
  selector: 'app-status-pill',
  templateUrl: './status-pill.html',
  styleUrl: './status-pill.css',
})
export class StatusPill {
  readonly label = input.required<string>();
  readonly tone = input<'success' | 'warning' | 'danger' | 'info' | 'neutral'>('info');
}
