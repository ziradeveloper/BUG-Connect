import { provideZonelessChangeDetection, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { WorkspaceContext } from '../../core/workspace/workspace-context';
import type { ResolvedWorkspace } from '../../core/workspace/workspace.model';
import { InboxShellComponent } from './inbox-shell';

/**
 * Pins the queue contract the thread pane depends on: tab counts match the
 * filter each tab applies, and the list is unread-first, newest-first.
 */
describe('InboxShellComponent', () => {
  const resolution = signal<ResolvedWorkspace>({
    kind: 'client',
    slug: 'nazeel',
    host: 'nazeel.localhost',
    source: 'subdomain',
  });

  let fixture: ComponentFixture<InboxShellComponent>;
  let component: InboxShellComponent;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [InboxShellComponent],
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
      ],
    });

    fixture = TestBed.createComponent(InboxShellComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('keeps tab counts in sync with the filtered list', () => {
    for (const tab of component.tabs) {
      component.activeTab.set(tab.id);
      expect(component.filteredList().length).toBe(component.tabCount(tab.id));
    }
  });

  it('sorts unread first and newest activity first within each group', () => {
    component.activeTab.set('open');
    const list = component.filteredList();

    expect(list.length).toBeGreaterThan(1);

    for (let i = 1; i < list.length; i += 1) {
      const prev = list[i - 1]!;
      const current = list[i]!;

      if (prev.unreadCount === current.unreadCount) {
        expect(prev.lastAtIso.localeCompare(current.lastAtIso)).toBeGreaterThanOrEqual(0);
      } else {
        expect(prev.unreadCount).toBeGreaterThan(current.unreadCount);
      }
    }
  });

  it('searches across contact, subject and preview', () => {
    component.activeTab.set('open');
    const first = component.filteredList()[0]!;
    const needle = first.contactName.slice(0, 4);

    component.search.set(needle);

    const filtered = component.filteredList();
    expect(filtered.length).toBeGreaterThan(0);
    expect(
      filtered.every((item) =>
        `${item.contactName} ${item.subject} ${item.preview}`.toLowerCase().includes(needle.toLowerCase()),
      ),
    ).toBe(true);
  });
});
