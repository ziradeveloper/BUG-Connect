import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { MockDataService } from '../../core/data/mock-data.service';
import { WorkspaceContext } from '../../core/workspace/workspace-context';
import type { ResolvedWorkspace } from '../../core/workspace/workspace.model';
import { WhatsappSettingsPage } from './whatsapp-settings-page';

describe('WhatsappSettingsPage', () => {
  const resolution = signal<ResolvedWorkspace>({
    kind: 'client',
    slug: 'nazeel',
    host: 'nazeel.localhost',
    source: 'subdomain',
  });

  let component: WhatsappSettingsPage;
  let fixture: ComponentFixture<WhatsappSettingsPage>;

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();

    await TestBed.configureTestingModule({
      imports: [WhatsappSettingsPage],
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

    fixture = TestBed.createComponent(WhatsappSettingsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('reflects the resolved tenant connection state', () => {
    const data = TestBed.inject(MockDataService);
    const tenant = data.currentTenant();

    expect(tenant?.subdomain).toBe('nazeel');
    expect(component['tenant']()?.id).toBe(tenant?.id);
    expect(component['connected']()).toBe(Boolean(tenant?.metaWabaId));
  });

  it('counts recent failures from the tenant webhook window', () => {
    const failed = component['recentEvents']().filter((event) => event.outcome === 'failed').length;

    expect(component['failedEvents']()).toBe(failed);
  });
});
