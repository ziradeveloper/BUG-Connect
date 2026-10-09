import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { PageHeader, PlannedState } from '../../shared/ui/ui';

export type PlannedConfig = {
  eyebrow: string;
  title: string;
  phase: string;
  description: string;
  icon: string;
  includes: string[];
  /** What is already true about this module in the current build. */
  note?: string;
};

/**
 * Every module the PRD schedules beyond the current wave gets one of these
 * rather than a dead link. The sidebar entry, the route and the guard all
 * resolve normally — only the screen is honest about not existing yet.
 *
 * Bound from `route.data.planned`, so a module's stub is one entry in
 * later.routes.ts and nothing extra is imported per page.
 */
@Component({
  selector: 'app-planned-module-page',
  imports: [PageHeader, PlannedState],
  template: `
    <div class="workspace-page">
      @if (planned(); as config) {
        <app-page-header
          [eyebrow]="config.eyebrow"
          [title]="config.title"
          [description]="config.description"
        />

        <app-planned-state
          [icon]="config.icon"
          [phase]="config.phase"
          [title]="config.title"
          [description]="config.description"
          [includes]="config.includes"
          back="/"
        />

        @if (config.note) {
          <p class="planned-note text-muted">{{ config.note }}</p>
        }
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlannedModulePage {
  readonly planned = input<PlannedConfig | undefined>(undefined);
}
