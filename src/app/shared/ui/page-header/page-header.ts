import { Component, input } from '@angular/core';

/** Section heading used by every workspace page, with an optional action slot. */
@Component({
  selector: 'app-page-header',
  templateUrl: './page-header.html',
})
export class PageHeader {
  readonly eyebrow = input('');
  readonly title = input.required<string>();
  readonly description = input('');
}
