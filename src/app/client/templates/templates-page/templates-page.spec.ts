import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SessionService } from '../../../core/auth/session.service';
import { MockDataService } from '../../../core/data/mock-data.service';
import { WorkspaceContext } from '../../../core/workspace/workspace-context';
import type { ResolvedWorkspace } from '../../../core/workspace/workspace.model';
import { TemplatesPage } from './templates-page';

describe('TemplatesPage', () => {
  const resolution = signal<ResolvedWorkspace>({
    kind: 'client',
    slug: 'nazeel',
    host: 'nazeel.localhost',
    source: 'subdomain',
  });

  let component: TemplatesPage;
  let fixture: ComponentFixture<TemplatesPage>;
  let data: MockDataService;

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.resetTestingModule();

    await TestBed.configureTestingModule({
      imports: [TemplatesPage],
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
    fixture = TestBed.createComponent(TemplatesPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('lists the workspace catalogue with statuses', async () => {
    await data.listTemplates();
    fixture.detectChanges();

    expect(data.templates().length).toBeGreaterThan(0);
    expect(text()).toContain('order_confirmation');
    expect(text()).toContain('Approved');
  });

  it('filters rows by category tab', () => {
    component['category'].set('MARKETING');
    fixture.detectChanges();

    const rows = component['rows']();
    expect(rows.every((template) => template.category === 'MARKETING')).toBe(true);
  });

  it('submits a draft for Meta review', async () => {
    const draft = await data.saveTemplate({ name: 'spec_submit_me', body: 'Hello {{1}}' });
    await component['submit'](draft);
    fixture.detectChanges();

    expect(data.templates().find((template) => template.id === draft.id)!.status).toBe('pending');
    expect(text()).toContain('submitted to Meta');
  });
});
