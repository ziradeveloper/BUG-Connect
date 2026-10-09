import { ChangeDetectionStrategy, Component, computed, output, signal } from '@angular/core';

import type { ContactCard } from '../../../../core/data/whatsapp';

interface DraftContact extends ContactCard {
  key: string;
}

/**
 * Sends one or more contact cards — the Cloud API `contacts` object. Agents use
 * it to hand over a colleague's or a delivery partner's number.
 */
@Component({
  selector: 'app-contact-picker-dialog',
  standalone: true,
  templateUrl: './contact-picker-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactPickerDialog {
  readonly confirm = output<ContactCard[]>();

  readonly visible = signal(false);

  readonly contacts = signal<DraftContact[]>([
    { key: `card-${Date.now()}`, name: '', phone: '', email: '', organization: '' },
  ]);

  readonly filled = computed(() =>
    this.contacts().filter((card) => card.name.trim() && card.phone.trim()),
  );

  readonly errors = computed<string[]>(() => {
    if (this.filled().length === 0) {
      return ['Add a name and a phone number.'];
    }

    const invalid = this.filled().find((card) => !/^[+\d][\d\s()-]{5,}$/.test(card.phone.trim()));
    return invalid ? ['Phone numbers must contain digits, spaces or + ( ) - only.'] : [];
  });

  readonly canSend = computed(() => this.errors().length === 0);

  open(): void {
    this.contacts.set([freshCard()]);
    this.visible.set(true);
  }

  close(): void {
    this.visible.set(false);
  }

  add(): void {
    this.contacts.update((items) => [...items, freshCard()]);
  }

  remove(key: string): void {
    if (this.contacts().length === 1) {
      this.contacts.set([freshCard()]);
      return;
    }

    this.contacts.update((items) => items.filter((item) => item.key !== key));
  }

  update(key: string, field: 'name' | 'phone' | 'email', event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.contacts.update((items) =>
      items.map((item) => (item.key === key ? { ...item, [field]: value } : item)),
    );
  }

  send(): void {
    if (!this.canSend()) return;

    this.confirm.emit(
      this.filled().map((card) => ({
        name: card.name.trim(),
        phone: card.phone.trim(),
        email: card.email?.trim() || undefined,
        organization: card.organization?.trim() || undefined,
      })),
    );

    this.close();
  }
}

function freshCard(): DraftContact {
  return { key: `card-${Date.now()}-${Math.random()}`, name: '', phone: '', email: '' };
}
