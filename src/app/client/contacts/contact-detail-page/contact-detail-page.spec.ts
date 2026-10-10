import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SessionService } from '../../../core/auth/session.service';
import { MockDataService } from '../../../core/data/mock-data.service';
import type { Contact } from '../../../core/data/entities';
import { WorkspaceContext } from '../../../core/workspace/workspace-context';
import type { ResolvedWorkspace } from '../../../core/workspace/workspace.model';
import { ContactDetailPage } from './contact-detail-page';

describe('ContactDetailPage', () => {
  const resolution = signal<ResolvedWorkspace>({
    kind: 'client',
    slug: 'nazeel',
    host: 'nazeel.localhost',
    source: 'subdomain',
  });

  let component: ContactDetailPage;
  let fixture: ComponentFixture<ContactDetailPage>;
  let data: MockDataService;
  let contact: Contact;

  async function setup(contactId: string | 'first'): Promise<void> {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.resetTestingModule();

    await TestBed.configureTestingModule({
      imports: [ContactDetailPage],
      providers: [
        provideRouter([]),
        {
          provide: WorkspaceContext,
          useValue: {
            resolved: resolution.asReadonly(),
            kind: computed(() => resolution().kind),
            slug: computed(() => resolution().slug),
            isPlatform: computed(() => resolution().kind === 'platform'),
            isClient: computed(() => resolution().kind === 'client'),
            isMarketing: computed(() => resolution().kind === 'marketing'),
            isWorkspace: computed(() => resolution().kind !== 'marketing'),
            displayName: computed(() => resolution().slug ?? 'Workspace'),
            canOverride: computed(() => true),
            setDevWorkspace: () => {},
          },
        },
      ],
    }).compileComponents();

    TestBed.inject(SessionService).loginAs('admin');
    data = TestBed.inject(MockDataService);
    contact = data.contacts().find((candidate) => candidate.conversationCount > 0)!;
    fixture = TestBed.createComponent(ContactDetailPage);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('contactId', contactId === 'first' ? contact.id : contactId);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  it('should create', async () => {
    await setup('missing');
    expect(component).toBeTruthy();
  });

  it('shows the not-found state for an unknown contact', async () => {
    await setup('no-such-contact');
    expect(text()).toContain('Contact not found');
  });

  it('renders the profile and the thread timeline', async () => {
    await setup('first');

    expect(text()).toContain(contact.displayName);
    expect(text()).toContain(contact.waId);

    const threads = data.conversationsForContact(contact.id);
    expect(threads.length).toBeGreaterThan(0);
    for (const thread of threads) {
      expect(text()).toContain(thread.subject);
    }
  });

  it('saves profile edits back to the workspace', async () => {
    await setup('first');

    component['displayName'].set('Renamed Customer');
    component['tags'].set(['VIP-Retail']);
    await component['save'](data.contactById(contact.id)!);
    fixture.detectChanges();

    const saved = data.contactById(contact.id)!;
    expect(saved.displayName).toBe('Renamed Customer');
    expect(saved.tags).toEqual(['VIP-Retail']);
    expect(text()).toContain('Contact saved');
  });

  it('toggles opt-in status with an explanatory notice', async () => {
    await setup('first');
    const wasOptedIn = contact.optInStatus;

    await component['toggleOptIn'](contact);
    fixture.detectChanges();

    expect(data.contactById(contact.id)!.optInStatus).toBe(!wasOptedIn);
    expect(text()).toContain(wasOptedIn ? 'opted out' : 'opted back in');
  });
});
