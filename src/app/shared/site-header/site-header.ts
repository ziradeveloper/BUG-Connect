import { Component, inject, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ThemeService } from '../../core/theme/theme';

@Component({
  selector: 'app-site-header',
  imports: [RouterLink],
  templateUrl: './site-header.html',
  styleUrl: './site-header.css',
})
export class SiteHeader {
  @Input() showMarketingLinks = true;

  protected readonly theme = inject(ThemeService);
  protected menuOpen = false;

  protected toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
  }

  protected closeMenu(): void {
    this.menuOpen = false;
  }
}
