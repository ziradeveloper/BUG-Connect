import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SessionService } from '../../../core/auth/session.service';
import { MockDataService } from '../../../core/data/mock-data.service';
import { WorkspaceContext } from '../../../core/workspace/workspace-context';
import type { ResolvedWorkspace } from '../../../core/workspace/workspace.model';
import { BusinessSettingsPage } from './business-settings-page';

describe('BusinessSettingsPage', () => {
  const resolution = signal<ResolvedWorkspace>({
    kind: 'client',
    slug: 'nazeel',
    host: 'nazeel.localhost',
    source: 'subdomain',
  });

  let component: BusinessSettingsPage;
  let fixture: ComponentFixture<BusinessSettingsPage>;
  let data: MockDataService;

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.resetTestingModule();

    await TestBed.configureTestingModule({
      imports: [BusinessSettingsPage],
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
    fixture = TestBed.createComponent(BusinessSettingsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads the seeded profile with a six-day week', async () => {
    await data.getBusinessProfile();
    fixture.detectChanges();

    const profile = data.businessProfile()!;
    expect(profile.displayName).toContain('Nazeel');
    expect(profile.hours.filter((day) => day.open)).toHaveLength(6);
    expect(text()).toContain('Operating hours');
    expect(text()).toContain('Out-of-hours auto-responder');
  });

  it('rejects a bad email and an always-closed week', async () => {
    component['update']({ email: 'not-an-email' });
    expect(component['emailError']()).toContain('valid');
    await component['save']();
    fixture.detectChanges();
    expect(text()).toContain('valid');

    component['update']({
      email: 'care@nazeel.example.com',
      hours: component['draft']()!.hours.map((day) => ({ ...day, open: false })),
    });
    expect(component['hoursError']()).toContain('at least one day');
    await component['save']();
    fixture.detectChanges();
    expect(text()).toContain('at least one day');
  });

  it('saves profile edits with an audit stamp', async () => {
    component['update']({ displayName: 'Nazeel Silks — Anna Nagar', email: 'care@nazeel.example.com' });
    await component['save']();
    fixture.detectChanges();

    const saved = data.businessProfile()!;
    expect(saved.displayName).toBe('Nazeel Silks — Anna Nagar');
    expect(text()).toContain('Profile saved');
  });
});
