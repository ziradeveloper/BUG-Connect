import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SessionService } from '../../../core/auth/session.service';
import { MockDataService } from '../../../core/data/mock-data.service';
import { WorkspaceContext } from '../../../core/workspace/workspace-context';
import type { ResolvedWorkspace } from '../../../core/workspace/workspace.model';
import { TemplateEditorPage } from './template-editor-page';

describe('TemplateEditorPage', () => {
  const resolution = signal<ResolvedWorkspace>({
    kind: 'client',
    slug: 'nazeel',
    host: 'nazeel.localhost',
    source: 'subdomain',
  });

  let component: TemplateEditorPage;
  let fixture: ComponentFixture<TemplateEditorPage>;
  let data: MockDataService;

  async function setup(templateId: string | null): Promise<void> {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.resetTestingModule();

    await TestBed.configureTestingModule({
      imports: [TemplateEditorPage],
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
    fixture = TestBed.createComponent(TemplateEditorPage);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('templateId', templateId);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  function fill(body = 'Hi {{1}}, order {{2}} is ready.'): void {
    component['update']({ name: 'spec_template', body });
  }

  it('should create', async () => {
    await setup(null);
    expect(component).toBeTruthy();
  });

  it('detects variables and previews them with samples', async () => {
    await setup(null);
    fill();
    component['updateSample']('1', 'Meera');
    fixture.detectChanges();

    expect(component['detectedVars']()).toEqual(['1', '2']);
    expect(component['previewBody']()).toContain('Meera');
    expect(text()).toContain('2 variables');
  });

  it('rejects non-sequential variables the way Meta review would', async () => {
    await setup(null);
    fill('Hi {{1}}, code {{3}} is wrong.');
    expect(component['bodyError']()).toContain('no gaps');
    expect(component['valid']()).toBe(false);
  });

  it('rejects duplicate names within the workspace', async () => {
    await setup(null);
    component['update']({ name: 'order_confirmation', body: 'Hello' });
    expect(component['nameError']()).toContain('already has');
  });

  it('saves a draft with buttons and sample labels', async () => {
    await setup(null);
    fill();
    component['addButton']();
    component['updateButton'](0, { text: 'Track order' });
    component['updateSample']('2', 'ORD-42');
    await component['save']();

    const saved = data.templates().find((template) => template.name === 'spec_template')!;
    expect(saved).toBeTruthy();
    expect(saved.status).toBe('draft');
    expect(saved.variables).toBe(2);
    expect(saved.buttons?.[0]?.text).toBe('Track order');
    expect(saved.variableLabels?.[1]).toBe('ORD-42');
  });

  it('locks templates Meta has already seen', async () => {
    const approved = data.templates().find((template) => template.status === 'approved')!;
    await setup(approved.id);

    expect(component['locked']()).toBe(true);
    expect(text()).toContain('locked');
  });
});
