import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Placeholder for a module scheduled in a later phase.
 */
@Component({
  selector: 'app-planned-state',
  imports: [RouterLink],
  templateUrl: './planned-state.html',
})
export class PlannedState {
  readonly title = input.required<string>();
  readonly description = input('');
  readonly phase = input('Planned in a later phase');
  readonly icon = input('◌');
  readonly includes = input<string[]>([]);
  readonly back = input('/');
}
