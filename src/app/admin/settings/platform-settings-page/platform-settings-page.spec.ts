import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SessionService } from '../../../core/auth/session.service';
import { MockDataService } from '../../../core/data/mock-data.service';
import { WorkspaceContext } from '../../../core/workspace/workspace-context';
import type { ResolvedWorkspace } from '../../../core/workspace/workspace.model';
import { PlatformSettingsPage } from './platform-settings-page';

describe('PlatformSettingsPage', () => {
  const resolution = signal<ResolvedWorkspace>({
    kind: 'platform',
    slug: null,
    host: 'admin.localhost',
    source: 'subdomain',
  });

  let component: PlatformSettingsPage;
  let fixture: ComponentFixture<PlatformSettingsPage>;

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();

    await TestBed.configureTestingModule({
      imports: [PlatformSettingsPage],
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
            displayName: computed(() => 'Platform console'),
            canOverride: computed(() => true),
            setDevWorkspace: () => {},
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PlatformSettingsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('starts from the live record', () => {
    const data = TestBed.inject(MockDataService);

    expect(component['draft'].platformName).toBe(data.platformSettings().platformName);
    expect(component['savedAt']()).toBeNull();
  });

  it('saves the draft, stamps the operator and writes the audit row', async () => {
    const data = TestBed.inject(MockDataService);
    const session = TestBed.inject(SessionService);
    session.loginAs('systemadmin');

    component['draft'].trialDays = 30;
    component['draft'].supportEmail = 'care@bugconnect.example';
    await component['save']();

    expect(data.platformSettings().trialDays).toBe(30);
    expect(data.platformSettings().supportEmail).toBe('care@bugconnect.example');
    expect(data.platformSettings().updatedBy).toBeTruthy();
    expect(component['savedAt']()).toBeTruthy();
    expect(component['notice']()).toBeTruthy();
    expect(component['error']()).toBeNull();

    expect(
      data.platformAudit().some((row) => row.action.startsWith('Updated platform settings')),
    ).toBe(true);
  });

  it('refuses invalid fields before writing anything', async () => {
    const data = TestBed.inject(MockDataService);
    const before = data.platformSettings().supportEmail;

    component['draft'].supportEmail = 'not-an-email';
    await component['save']();
    expect(component['error']()).toContain('valid support email');

    component['draft'].supportEmail = 'ok@bugconnect.example';
    component['draft'].apexDomain = '';
    await component['save']();
    expect(component['error']()).toContain('apex domain');

    expect(data.platformSettings().supportEmail).toBe(before);
  });
});
