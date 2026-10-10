import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SessionService } from '../../../core/auth/session.service';
import { MockDataService } from '../../../core/data/mock-data.service';
import { WorkspaceContext } from '../../../core/workspace/workspace-context';
import type { ResolvedWorkspace } from '../../../core/workspace/workspace.model';
import { SegmentsPage } from './segments-page';

describe('SegmentsPage', () => {
  const resolution = signal<ResolvedWorkspace>({
    kind: 'client',
    slug: 'nazeel',
    host: 'nazeel.localhost',
    source: 'subdomain',
  });

  let component: SegmentsPage;
  let fixture: ComponentFixture<SegmentsPage>;
  let data: MockDataService;

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.resetTestingModule();

    await TestBed.configureTestingModule({
      imports: [SegmentsPage],
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
    fixture = TestBed.createComponent(SegmentsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('lists the seeded segments with live match counts', () => {
    expect(data.segments().length).toBeGreaterThan(0);
    for (const segment of data.segments()) {
      expect(text()).toContain(segment.name);
    }
    expect(text()).toContain('contacts');
  });

  it('evaluates the draft live as rules change', () => {
    component['newSegment']();
    component['updateRule'](0, { field: 'optIn', operator: 'is', value: 'opted-in' });
    fixture.detectChanges();

    const expected = data.contacts().filter((contact) => contact.optInStatus).length;
    expect(component['preview']().length).toBe(expected);
    expect(text()).toContain(`${expected} contacts match`);
  });

  it('requires a name and a value on every rule', async () => {
    component['newSegment']();
    component['updateDraft']({ name: '' });
    await component['save']();
    fixture.detectChanges();
    expect(text()).toContain('needs a name');

    component['updateDraft']({ name: 'Nameless rules' });
    await component['save']();
    fixture.detectChanges();
    expect(text()).toContain('Every rule needs a value');
    expect(data.segments().some((segment) => segment.name === 'Nameless rules')).toBe(false);
  });

  it('saves a new segment and deletes it again', async () => {
    component['newSegment']();
    component['updateDraft']({ name: 'Spec audience' });
    component['updateRule'](0, { field: 'tag', operator: 'has', value: 'VIP-Retail' });
    await component['save']();
    fixture.detectChanges();

    const saved = data.segments().find((segment) => segment.name === 'Spec audience');
    expect(saved).toBeTruthy();
    expect(text()).toContain('now matches');

    component['pendingDelete'].set(saved!);
    await component['confirmDelete']();
    expect(data.segments().some((segment) => segment.name === 'Spec audience')).toBe(false);
  });
});
