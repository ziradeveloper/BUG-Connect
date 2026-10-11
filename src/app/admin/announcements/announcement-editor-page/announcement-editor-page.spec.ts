import { Component, computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { SessionService } from '../../../core/auth/session.service';
import { MockDataService } from '../../../core/data/mock-data.service';
import { WorkspaceContext } from '../../../core/workspace/workspace-context';
import type { ResolvedWorkspace } from '../../../core/workspace/workspace.model';
import { AnnouncementEditorPage } from './announcement-editor-page';

/** Stands in for the list the editor navigates to after a save. */
@Component({ selector: 'app-blank', template: '' })
class BlankPage {}

/**
 * Announcement editor (`/announcements/new`, wave 6).
 *
 * The editor's contract is that it shows the truth before the write: the reach
 * counted from the live tenant list, the banner as a workspace sees it, and the
 * reasons a publish would be refused — which the service then refuses for the
 * same reasons.
 */
describe('AnnouncementEditorPage', () => {
  const resolution = signal<ResolvedWorkspace>({
    kind: 'platform',
    slug: null,
    host: 'admin.localhost',
    source: 'subdomain',
  });

  let component: AnnouncementEditorPage;
  let fixture: ComponentFixture<AnnouncementEditorPage>;
  let data: MockDataService;
  let router: Router;

  const text = (): string => (fixture.nativeElement as HTMLElement).textContent ?? '';

  async function create(id = ''): Promise<void> {
    fixture = TestBed.createComponent(AnnouncementEditorPage);

    if (id) {
      fixture.componentRef.setInput('id', id);
    }

    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.resetTestingModule();

    await TestBed.configureTestingModule({
      imports: [AnnouncementEditorPage],
      providers: [
        provideRouter([
          { path: 'announcements', component: BlankPage },
          { path: 'announcements/:id', component: BlankPage },
        ]),
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
            displayName: computed(() => 'Platform console'),
            canOverride: computed(() => true),
            setDevWorkspace: () => {},
          },
        },
      ],
    }).compileComponents();

    data = TestBed.inject(MockDataService);
    router = TestBed.inject(Router);
    TestBed.inject(SessionService).loginAs('systemadmin');
  });

  it('starts a new notice as a draft that is not ready to send', async () => {
    await create();

    expect(component['isNew']()).toBe(true);
    expect(component['state']()).toBe('draft');
    expect(component['stateLabel']()).toBe('Draft');
    expect(component['title']()).toBe('');
    // An empty notice is refused, and the editor says why.
    expect(component['issues']()).toContain('Give the notice a title.');
    expect(text()).toContain('Who it reaches');
    expect(text()).toContain('As a workspace sees it');
    // By default it goes to everyone.
    expect(component['reach']().workspaces).toBe(data.tenants().length);
    expect(component['audienceSummary']()).toBe('Every workspace');
  });

  it('loads an existing notice into the form and reads its state', async () => {
    await create('ann-invoices');

    const saved = data.announcementById('ann-invoices')!;

    expect(component['title']()).toBe(saved.title);
    expect(component['body']()).toBe(saved.body);
    expect(component['kind']()).toBe('billing');
    expect(component['audienceType']()).toBe('tiers');
    expect(component['tiers']()).toEqual(['Pilot']);
    expect(component['pinned']()).toBe(saved.pinned);
    // Publish time round-trips through the workspace-timezone picker.
    expect(component['draft']().publishAt).toBe(saved.publishAt);
    expect(component['state']()).toBe('scheduled');
    expect(component['stateLabel']()).toBe('Scheduled');
    expect(component['reach']().workspaces).toBe(
      data.tenants().filter((tenant) => tenant.subscriptionTier === 'Pilot').length,
    );
  });

  it('counts the reach as the audience changes', async () => {
    await create();

    expect(component['reach']().workspaces).toBe(data.tenants().length);

    component['setAudience']('tiers');
    component['toggleTier']('Scale');
    fixture.detectChanges();

    const scale = data.tenants().filter((tenant) => tenant.subscriptionTier === 'Scale');

    expect(component['reach']().workspaces).toBe(scale.length);
    expect(component['reach']().seats).toBe(scale.reduce((total, tenant) => total + tenant.seatsUsed, 0));
    expect(component['audienceSummary']()).toBe('Scale plans');
    expect(component['matched']().map((tenant) => tenant.id)).toEqual(scale.map((tenant) => tenant.id));
    expect(text()).toContain('Scale plans');

    component['toggleTier']('Scale');

    expect(component['reach']().workspaces).toBe(0);
    expect(component['issues']()).toContain('Pick the plan tiers this notice is for.');
  });

  it('clears the issues once the notice says something', async () => {
    await create();

    component['title'].set('Webhook queue maintenance on 20 October');
    component['body'].set(
      'We are moving webhook ingestion to a new queue between 02:00 and 03:00 IST. Nothing is dropped; retries run for 24 hours.',
    );
    fixture.detectChanges();

    expect(component['issues']()).toEqual([]);
    expect(text()).toContain('Ready to send to');
    expect(component['paragraphs']()).toHaveLength(1);
  });

  it('refuses a publish the editor flagged, and writes nothing', async () => {
    await create();
    const before = data.announcements().length;

    await component['publish']();
    fixture.detectChanges();

    expect(component['refused']()).toContain('Give the notice a title.');
    expect(data.announcements()).toHaveLength(before);
    expect(text()).toContain('The last publish attempt was refused');
  });

  it('publishes a good notice and points the URL at it', async () => {
    await create();

    component['title'].set('Status page: delivery delays on 22 October');
    component['body'].set(
      'Meta is reporting elevated latency on template delivery between 14:00 and 16:00 IST. Queued sends are held and retried automatically.',
    );
    component['setAudience']('tenants');
    component['toggleTenant']('tenant-1');

    await component['publish']();
    fixture.detectChanges();

    expect(component['refused']()).toEqual([]);
    expect(component['notice']()).toContain('1 workspaces');
    const saved = data.announcements().find((row) => row.title.startsWith('Status page'));

    expect(saved?.status).toBe('published');
    expect(saved?.audience.tenantIds).toEqual(['tenant-1']);
    expect(router.url).toBe(`/announcements/${saved?.id}`);
  });

  it('saves a draft without validating it', async () => {
    await create();
    const before = data.announcements().length;

    component['title'].set('Rough notes');

    await component['saveDraft']();
    fixture.detectChanges();

    expect(data.announcements()).toHaveLength(before + 1);
    expect(component['notice']()).toBe('Draft saved.');
    // An unfinished draft is the point, so no refusal.
    expect(component['refused']()).toEqual([]);
  });

  it('applies the schedule presets on the workspace clock', async () => {
    await create();

    const tomorrow = component['presets'][1]!;

    component['applyPreset'](tomorrow.value);
    expect(component['publishAtLocal']()).toBe(tomorrow.value);
    expect(component['publishAtLocal']()).toMatch(/T09:00$/);

    component['applyExpiryPreset'](3);
    expect(component['expiresAtLocal']()).toMatch(/T18:00$/);
    expect(component['draft']().expiresAt).not.toBeNull();

    component['expiresAtLocal'].set('');
    expect(component['draft']().expiresAt).toBeNull();
  });

  it('flags an expiry that lands before the publish time', async () => {
    await create('ann-maintenance');

    // The seeded maintenance notice expires in three days; publish it yesterday.
    component['publishAtLocal'].set(component['presets'][2]!.value);
    component['applyExpiryPreset'](3);
    fixture.detectChanges();

    expect(component['issues']()).toContain('The notice has to expire after it is published.');
  });

  it('withdraws the open notice', async () => {
    await create('ann-flow-builder');

    component['askWithdraw']();
    expect(component['pendingWithdraw']()).toBe(true);

    await component['confirmWithdraw']();
    fixture.detectChanges();

    expect(data.announcementById('ann-flow-builder')?.status).toBe('withdrawn');
    expect(component['state']()).toBe('withdrawn');
    expect(component['notice']()).toContain('Withdrawn');
  });
});
