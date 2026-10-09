import { provideZonelessChangeDetection, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { WorkspaceContext } from '../../../core/workspace/workspace-context';
import type { ResolvedWorkspace } from '../../../core/workspace/workspace.model';
import { ConversationDetailPageComponent } from './conversation-detail-page';

/**
 * Renders the whole thread against the seeded dataset. Unit tests cover each
 * bubble in isolation; this one proves the page wires them together — routing,
 * the timeline, the composer and the customer panel — without a runtime error.
 */
describe('ConversationDetailPage', () => {
  const resolution = signal<ResolvedWorkspace>({
    kind: 'client',
    slug: 'nazeel',
    host: 'nazeel.localhost',
    source: 'subdomain',
  });

  let fixture: ComponentFixture<ConversationDetailPageComponent>;

  async function open(conversationId: string | null): Promise<HTMLElement> {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ConversationDetailPageComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        {
          provide: WorkspaceContext,
          useValue: {
            resolved: resolution.asReadonly(),
            kind: () => resolution().kind,
            slug: () => resolution().slug,
            isPlatform: () => false,
            isClient: () => true,
            isMarketing: () => false,
            isWorkspace: () => true,
            displayName: () => 'Nazeel',
            canOverride: () => true,
            setDevWorkspace: () => {},
          },
        },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of({ get: () => conversationId }) },
        },
      ],
    });

    fixture = TestBed.createComponent(ConversationDetailPageComponent);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders the header, timeline and composer for a real conversation', async () => {
    const host = await open('tenant-1-conv-1');

    expect(host.querySelector('.conv-header__name')?.textContent?.trim()).toBeTruthy();
    expect(host.querySelectorAll('app-message-bubble').length).toBeGreaterThan(0);
    expect(host.querySelector('app-message-composer')).toBeTruthy();
    expect(host.querySelector('.conv-day')).toBeTruthy();
  });

  it('keeps the thread and the composer as separate surfaces', async () => {
    const host = await open('tenant-1-conv-1');

    // The composer is a sibling of the scrolling body, not a child of it.
    const body = host.querySelector('.conv-body');
    expect(body?.querySelector('.conv-thread')).toBeTruthy();
    expect(body?.querySelector('app-message-composer')).toBeNull();
  });

  it('puts only the thread in charge of scrolling', async () => {
    const host = await open('tenant-1-conv-1');
    const thread = host.querySelector('.conv-thread') as HTMLElement;
    const queue = host.querySelector('.inbox-list');

    expect(thread).toBeTruthy();
    expect(queue).toBeNull();
  });

  it('shows the not-found state for an unknown conversation', async () => {
    const host = await open('nope');
    expect(host.querySelector('.conv-not-found')).toBeTruthy();
  });

  it('opens the customer panel on demand', async () => {
    const host = await open('tenant-1-conv-1');
    expect(host.querySelector('app-contact-panel')).toBeNull();

    host.querySelector<HTMLButtonElement>('.conv-btn--ghost')!.click();
    await fixture.whenStable();

    const panel = host.querySelector('app-contact-panel');
    expect(panel).toBeTruthy();
    expect(panel?.textContent).toContain('WhatsApp opt-in');
  });
});
