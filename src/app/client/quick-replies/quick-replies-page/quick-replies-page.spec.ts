import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SessionService } from '../../../core/auth/session.service';
import { MockDataService } from '../../../core/data/mock-data.service';
import { WorkspaceContext } from '../../../core/workspace/workspace-context';
import type { ResolvedWorkspace } from '../../../core/workspace/workspace.model';
import { QuickRepliesPage } from './quick-replies-page';

describe('QuickRepliesPage', () => {
  const resolution = signal<ResolvedWorkspace>({
    kind: 'client',
    slug: 'nazeel',
    host: 'nazeel.localhost',
    source: 'subdomain',
  });

  let component: QuickRepliesPage;
  let fixture: ComponentFixture<QuickRepliesPage>;
  let data: MockDataService;

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.resetTestingModule();

    await TestBed.configureTestingModule({
      imports: [QuickRepliesPage],
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
    fixture = TestBed.createComponent(QuickRepliesPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('manages the same snippets the composer expands', async () => {
    await data.listQuickReplies();
    fixture.detectChanges();

    const triggers = data.quickReplies().map((reply) => reply.trigger);
    expect(triggers).toContain('/hours');
    expect(text()).toContain('/hours');
    expect(text()).toContain('Store hours');
  });

  it('rejects malformed and duplicate triggers', async () => {
    component['newReply']();
    component['update']({ trigger: 'no-slash', body: 'Body' });
    await component['save']();
    fixture.detectChanges();
    expect(text()).toContain('Triggers look like');

    component['update']({ trigger: '/hours', body: 'Body' });
    await component['save']();
    fixture.detectChanges();
    expect(text()).toContain('already uses that trigger');
  });

  it('creates and deletes a snippet', async () => {
    component['newReply']();
    component['update']({ trigger: '/spec', title: 'Spec snippet', body: 'Spec body' });
    await component['save']();
    fixture.detectChanges();

    const saved = data.quickReplies().find((reply) => reply.trigger === '/spec')!;
    expect(saved).toBeTruthy();
    expect(text()).toContain('live in the composer');

    component['pendingDelete'].set(saved);
    await component['confirmDelete']();
    expect(data.quickReplies().some((reply) => reply.trigger === '/spec')).toBe(false);
  });
});
