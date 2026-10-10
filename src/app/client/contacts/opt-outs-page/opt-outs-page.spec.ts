import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SessionService } from '../../../core/auth/session.service';
import { MockDataService } from '../../../core/data/mock-data.service';
import { WorkspaceContext } from '../../../core/workspace/workspace-context';
import type { ResolvedWorkspace } from '../../../core/workspace/workspace.model';
import { OptOutsPage } from './opt-outs-page';

describe('OptOutsPage', () => {
  const resolution = signal<ResolvedWorkspace>({
    kind: 'client',
    slug: 'nazeel',
    host: 'nazeel.localhost',
    source: 'subdomain',
  });

  let component: OptOutsPage;
  let fixture: ComponentFixture<OptOutsPage>;
  let data: MockDataService;

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.resetTestingModule();

    await TestBed.configureTestingModule({
      imports: [OptOutsPage],
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
    fixture = TestBed.createComponent(OptOutsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('lists only opted-out contacts', async () => {
    await component['load']();
    await fixture.whenStable();
    fixture.detectChanges();
    fixture.detectChanges();

    const rows = component['rows']();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((contact) => !contact.optInStatus)).toBe(true);
  });

  it('resubscribes a contact off the list', async () => {
    const contact = component['rows']()[0]!;
    await component['resubscribe'](contact);
    fixture.detectChanges();

    expect(data.contactById(contact.id)!.optInStatus).toBe(true);
    expect(component['rows']().some((row) => row.id === contact.id)).toBe(false);
    expect(text()).toContain('opted back in');
  });

  it('stamps a manual Meta sync', async () => {
    await component['syncNow']();
    fixture.detectChanges();

    expect(component['lastSyncAt']()).not.toBeNull();
    expect(text()).toContain('Blocklist synced');
  });
});
