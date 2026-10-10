import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { MockDataService } from '../../core/data/mock-data.service';
import { PageHeader, StatusPill } from '../../shared/ui/ui';

/**
 * The Embedded Signup landing (`/settings/whatsapp/callback?code=&state=`).
 * Parses the authorization code Meta redirected back with, exchanges it for
 * the WABA connection, and flips a pending workspace to active.
 */
@Component({
  selector: 'app-whatsapp-callback-page',
  imports: [RouterLink, PageHeader, StatusPill],
  templateUrl: './whatsapp-callback-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WhatsappCallbackPage {
  /** Bound from the `?code=` Meta appends to the redirect. */
  readonly code = input<string | null>(null);
  readonly state = input<string | null>(null);

  protected readonly data = inject(MockDataService);

  protected readonly phase = signal<'working' | 'connected' | 'failed'>('working');
  protected readonly detail = signal<string>('Exchanging the authorization code with Meta…');

  constructor() {
    let started = false;

    effect(() => {
      if (started) {
        return;
      }
      started = true;

      const code = this.code();
      if (!code) {
        this.phase.set('failed');
        this.detail.set('Meta returned no authorization code. Restart the connection from WhatsApp settings.');
        return;
      }

      const tenantId = this.data.tenantId();
      const stamp = Date.now().toString().slice(-9);

      this.data
        .connectWaba(tenantId, {
          wabaId: `10${stamp}`,
          phoneNumberId: `10${stamp.split('').reverse().join('')}`,
          phoneNumber: `+91 98${stamp.slice(0, 8)}`.slice(0, 14),
        })
        .then((tenant) => {
          if (!tenant) {
            this.phase.set('failed');
            this.detail.set('No workspace is resolved for this host, so the connection had nowhere to land.');
            return;
          }
          this.phase.set('connected');
          this.detail.set(
            `${tenant.businessName} is connected as ${tenant.phoneNumber} (WABA ${tenant.metaWabaId}).`,
          );
        });
    });
  }
}
