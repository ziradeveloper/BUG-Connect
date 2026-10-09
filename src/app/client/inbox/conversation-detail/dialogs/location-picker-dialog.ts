import { ChangeDetectionStrategy, Component, computed, output, signal } from '@angular/core';

import type { LocationPayload } from '../../../../core/data/whatsapp';

interface LocationPreset extends LocationPayload {
  id: string;
  name: string;
  address: string;
}

const PRESETS: LocationPreset[] = [
  {
    id: 'store-town',
    name: 'Nazeel Silks — Town branch',
    address: '12 West Car Street, Tirunelveli 627001',
    latitude: 8.7139,
    longitude: 77.7567,
  },
  {
    id: 'store-palay',
    name: 'Nellai Sweets — Palayamkottai',
    address: '84 Trivandrum Road, Palayamkottai 627002',
    latitude: 8.7294,
    longitude: 77.7412,
  },
  {
    id: 'store-junction',
    name: 'Scanwell Diagnostics — High Ground',
    address: '3 High Ground, Tirunelveli 627002',
    latitude: 8.7265,
    longitude: 77.7512,
  },
];

/** Shares a pinned location — the Cloud API `location` object. */
@Component({
  selector: 'app-location-picker-dialog',
  standalone: true,
  templateUrl: './location-picker-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LocationPickerDialog {
  readonly confirm = output<LocationPayload>();

  readonly visible = signal(false);
  readonly presets = PRESETS;

  readonly name = signal('');
  readonly address = signal('');
  readonly latitude = signal('8.7139');
  readonly longitude = signal('77.7567');

  readonly latValue = computed(() => Number(this.latitude()));
  readonly lngValue = computed(() => Number(this.longitude()));

  readonly errors = computed<string[]>(() => {
    const errors: string[] = [];

    if (!this.latitude().trim() || Number.isNaN(this.latValue())) {
      errors.push('Latitude must be a number.');
    } else if (this.latValue() < -90 || this.latValue() > 90) {
      errors.push('Latitude must be between -90 and 90.');
    }

    if (!this.longitude().trim() || Number.isNaN(this.lngValue())) {
      errors.push('Longitude must be a number.');
    } else if (this.lngValue() < -180 || this.lngValue() > 180) {
      errors.push('Longitude must be between -180 and 180.');
    }

    return errors;
  });

  readonly canSend = computed(() => this.errors().length === 0);

  open(): void {
    this.applyPreset(this.presets[0]!);
    this.visible.set(true);
  }

  close(): void {
    this.visible.set(false);
  }

  applyPreset(preset: LocationPreset): void {
    this.name.set(preset.name);
    this.address.set(preset.address || '');
    this.latitude.set(String(preset.latitude));
    this.longitude.set(String(preset.longitude));
  }

  send(): void {
    if (!this.canSend()) return;

    this.confirm.emit({
      name: this.name().trim() || 'Shared location',
      address: this.address().trim() || undefined,
      latitude: this.latValue(),
      longitude: this.lngValue(),
    });

    this.close();
  }
}
