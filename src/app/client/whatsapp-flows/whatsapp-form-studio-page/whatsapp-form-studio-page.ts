import { DecimalPipe, DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { PermissionService } from '../../../core/authorization/permission.service';
import { MockDataService } from '../../../core/data/mock-data.service';
import type {
  WaFormCategory,
  WaFormComponentType,
  WaFormField,
  WaFormScreen,
  WhatsAppFlowForm,
} from '../../../core/data/entities';
import {
  categoryLabel,
  componentSpec,
  flowJson,
  flowJsonBytes,
  makeField,
  makeScreen,
  MAX_COMPONENTS_PER_SCREEN,
  responseShape,
  screenIdFor,
  slugFor,
  validateFlow,
  WA_FORM_CATEGORIES,
  WA_FORM_COMPONENTS,
  WA_INPUT_TYPES,
} from '../../../core/data/whatsapp-flows';
import { formatDateTime, formatRelative, initials } from '../../../shared/format';
import { ConfirmDialog, PageHeader, StatusPill } from '../../../shared/ui/ui';

/** The working copy the studio edits; saving writes it through the service. */
interface StudioDraft {
  id: string | null;
  name: string;
  category: WaFormCategory;
  screens: WaFormScreen[];
  linkedFlowId: string | null;
}

/**
 * WhatsApp Form Studio (`/whatsapp-flows/new`, `/whatsapp-flows/:id`, wave 6).
 *
 * A multi-screen designer over Meta's flow JSON: the left rail is the routing
 * model, the middle edits the selected screen's components, and the right shows
 * the same document three ways — as a phone preview, as the generated JSON that
 * would be posted to the Flows API, and as the validation Meta would return.
 * Nothing is written until Save, and publishing re-runs the validation server
 * side so a broken document cannot leave the workspace.
 */
@Component({
  selector: 'app-whatsapp-form-studio-page',
  imports: [DecimalPipe, FormsModule, RouterLink, PageHeader, StatusPill, ConfirmDialog],
  templateUrl: './whatsapp-form-studio-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WhatsAppFormStudioPage {
  private readonly data = inject(MockDataService);
  private readonly permissions = inject(PermissionService);
  private readonly document = inject(DOCUMENT);

  /** Route parameter (`/whatsapp-flows/:id`) via component input binding. */
  readonly id = input('');

  protected readonly palette = WA_FORM_COMPONENTS;
  protected readonly categories = WA_FORM_CATEGORIES;
  protected readonly inputTypes = WA_INPUT_TYPES;
  protected readonly maxComponents = MAX_COMPONENTS_PER_SCREEN;

  protected readonly notice = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly jsonCopied = signal(false);
  protected readonly pendingDeleteField = signal<WaFormField | null>(null);
  protected readonly pendingDeleteScreen = signal<WaFormScreen | null>(null);

  protected readonly canManage = computed(() => this.permissions.can('flows.manage', 'edit'));

  protected readonly stored = computed<WhatsAppFlowForm | null>(() =>
    this.data.waFlowById(this.id()),
  );

  /** Edits live here; the stored record is the fallback until the first change. */
  private readonly draftOverride = signal<StudioDraft | null>(null);

  protected readonly draft = computed<StudioDraft | null>(() => {
    const override = this.draftOverride();
    if (override) {
      return override;
    }

    const stored = this.stored();
    if (stored) {
      return {
        id: stored.id,
        name: stored.name,
        category: stored.category,
        screens: stored.screens,
        linkedFlowId: stored.linkedFlowId,
      };
    }

    // `/whatsapp-flows/new`: start from one terminal screen, the shape Meta
    // accepts for a single-screen lead capture.
    if (!this.id()) {
      const first = makeScreen([], 1);
      return {
        id: null,
        name: '',
        category: 'OTHER',
        screens: [{ ...first, fields: [] }],
        linkedFlowId: null,
      };
    }

    return null;
  });

  protected readonly dirty = computed(() => this.draftOverride() !== null);

  protected readonly selectedScreenId = signal<string | null>(null);
  protected readonly selectedFieldId = signal<string | null>(null);

  protected readonly screens = computed<WaFormScreen[]>(() => this.draft()?.screens ?? []);

  protected readonly selectedScreen = computed<WaFormScreen | null>(() => {
    const screens = this.screens();
    const explicit = screens.find((screen) => screen.id === this.selectedScreenId());
    return explicit ?? (screens[0] ?? null);
  });

  protected readonly selectedField = computed<WaFormField | null>(() => {
    const screen = this.selectedScreen();
    if (!screen) {
      return null;
    }
    const explicit = screen.fields.find((field) => field.id === this.selectedFieldId());
    return explicit ?? null;
  });

  protected readonly otherScreens = computed<WaFormScreen[]>(() =>
    this.screens().filter((screen) => screen.id !== this.selectedScreen()?.id),
  );

  protected readonly issues = computed<string[]>(() => {
    const draft = this.draft();
    return draft ? validateFlow(draft) : [];
  });

  protected readonly json = computed(() => {
    const draft = this.draft();
    return draft ? flowJson(draft) : '';
  });

  protected readonly jsonSize = computed(() => {
    const draft = this.draft();
    return draft ? flowJsonBytes(draft) : 0;
  });

  protected readonly response = computed<string[]>(() => {
    const draft = this.draft();
    return draft ? responseShape(draft) : [];
  });

  protected readonly flows = computed(() =>
    [...this.data.flows()].sort((a, b) => a.name.localeCompare(b.name)),
  );

  protected readonly businessName = computed(
    () => this.data.businessProfile()?.displayName ?? 'Your business',
  );

  protected readonly avatarInitials = computed(() => initials(this.businessName()));

  /** 0-based position of the screen being edited, for the preview's counter. */
  protected readonly screenIndex = computed(() => {
    const screens = this.screens();
    const selected = this.selectedScreen();
    const index = screens.findIndex((screen) => screen.id === selected?.id);
    return index < 0 ? 0 : index;
  });

  protected readonly status = computed(() => this.stored()?.status ?? 'draft');

  protected readonly statusLabel = computed(() => {
    switch (this.status()) {
      case 'published':
        return 'Published';
      case 'pending':
        return 'In review';
      case 'archived':
        return 'Archived';
      default:
        return 'Draft';
    }
  });

  protected readonly statusTone = computed<'success' | 'warning' | 'info' | 'neutral'>(() => {
    switch (this.status()) {
      case 'published':
        return 'success';
      case 'pending':
        return 'warning';
      case 'archived':
        return 'neutral';
      default:
        return 'info';
    }
  });

  protected readonly meta = computed(() => {
    const stored = this.stored();
    return {
      metaFlowId: stored?.metaFlowId ?? 'assigned on create',
      updatedLabel: stored ? formatRelative(stored.updatedAt) : 'not saved yet',
      updatedFull: stored ? formatDateTime(stored.updatedAt) : '—',
      submissions: stored?.submissions30d ?? 0,
      completion: stored?.completionRate ?? 0,
    };
  });

  protected specLabel(type: WaFormComponentType): string {
    return componentSpec(type).label;
  }

  protected glyph(type: WaFormComponentType): string {
    return componentSpec(type).glyph;
  }

  protected hint(type: WaFormComponentType): string {
    return componentSpec(type).hint;
  }

  protected collects(type: WaFormComponentType): boolean {
    return componentSpec(type).collects;
  }

  protected hasChoices(type: WaFormComponentType): boolean {
    return componentSpec(type).choices;
  }

  protected categoryText(category: WaFormCategory): string {
    return categoryLabel(category);
  }

  protected screenLabel(screen: WaFormScreen, index: number): string {
    return screen.title.trim() || `Screen ${index + 1}`;
  }

  protected fieldSummary(field: WaFormField): string {
    const parts = [componentSpec(field.type).label];
    if (componentSpec(field.type).collects) {
      parts.push(field.name ? `posts “${field.name}”` : 'no data key');
    }
    if (field.required && componentSpec(field.type).optionalFlag) {
      parts.push('required');
    }
    if (field.options?.length) {
      parts.push(`${field.options.length} options`);
    }
    return parts.join(' · ');
  }

  /* ── Draft plumbing ───────────────────────────────────────────── */

  private commit(next: StudioDraft): void {
    this.draftOverride.set(next);
  }

  private withScreens(screens: WaFormScreen[]): void {
    const draft = this.draft();
    if (!draft) {
      return;
    }
    this.commit({ ...draft, screens });
  }

  private patchDraft(patch: Partial<StudioDraft>): void {
    const draft = this.draft();
    if (!draft) {
      return;
    }
    this.commit({ ...draft, ...patch });
  }

  private patchScreen(screenId: string, patch: Partial<WaFormScreen>): void {
    this.withScreens(
      this.screens().map((screen) => (screen.id === screenId ? { ...screen, ...patch } : screen)),
    );
  }

  /* ── Form-level edits ─────────────────────────────────────────── */

  protected setName(name: string): void {
    this.patchDraft({ name });
  }

  protected setCategory(category: WaFormCategory): void {
    this.patchDraft({ category });
  }

  protected setLinked(linkedFlowId: string): void {
    this.patchDraft({ linkedFlowId: linkedFlowId || null });
  }

  /* ── Screen edits ─────────────────────────────────────────────── */

  protected selectScreen(screenId: string): void {
    this.selectedScreenId.set(screenId);
    this.selectedFieldId.set(null);
  }

  protected addScreen(): void {
    const screens = this.screens();
    const taken = screens.map((screen) => screen.id);
    const previous = screens[screens.length - 1];
    // The new screen takes over the ending, so the routing model always keeps
    // exactly one terminal: the previous last screen now navigates on.
    const fresh: WaFormScreen = {
      ...makeScreen(taken, screens.length + 1),
      terminal: true,
      footerLabel: 'Submit',
    };
    const next = screens.map((screen) =>
      screen.id === previous?.id
        ? { ...screen, terminal: false, nextScreenId: fresh.id, footerLabel: 'Continue' }
        : screen,
    );

    this.withScreens([...next, fresh]);
    this.selectScreen(fresh.id);
    this.notice.set(`Screen ${fresh.id} added — it now ends the form.`);
  }

  protected moveScreen(screenId: string, direction: -1 | 1): void {
    const screens = [...this.screens()];
    const index = screens.findIndex((screen) => screen.id === screenId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= screens.length) {
      return;
    }

    const [moved] = screens.splice(index, 1);
    screens.splice(target, 0, moved as WaFormScreen);
    this.withScreens(screens);
  }

  protected askRemoveScreen(screen: WaFormScreen): void {
    if (this.screens().length === 1) {
      this.error.set('A form needs at least one screen.');
      return;
    }
    this.pendingDeleteScreen.set(screen);
  }

  protected removeScreen(): void {
    const screen = this.pendingDeleteScreen();
    this.pendingDeleteScreen.set(null);
    if (!screen) {
      return;
    }

    const remaining = this.screens().filter((candidate) => candidate.id !== screen.id);

    // Screens that navigated to the removed one follow the new order, and the
    // last remaining screen ends the form — so the routing model stays walkable
    // and exactly one screen can still post.
    const repaired = remaining.map((candidate, index) => {
      const pointedHere = candidate.nextScreenId === screen.id;
      const isLast = index === remaining.length - 1;

      return {
        ...candidate,
        nextScreenId: pointedHere ? (remaining[index + 1]?.id ?? null) : candidate.nextScreenId,
        terminal: isLast ? true : pointedHere ? false : candidate.terminal,
      };
    });

    this.withScreens(repaired);
    this.selectedScreenId.set(repaired[0]?.id ?? null);
    this.selectedFieldId.set(null);
    this.notice.set(`Screen ${screen.id} removed.`);
  }

  protected setScreenTitle(title: string): void {
    const screen = this.selectedScreen();
    if (!screen) {
      return;
    }
    // Keep the Meta id in step until it has been edited away by hand.
    const automatic = screenIdFor(screen.title) === screen.id;
    this.patchScreen(screen.id, {
      title,
      ...(automatic ? { id: screenIdFor(title, this.otherScreens().map((row) => row.id)) } : {}),
    });
  }

  protected setScreenId(id: string): void {
    const screen = this.selectedScreen();
    if (!screen) {
      return;
    }

    const typed = id.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    const others = this.otherScreens().map((row) => row.id);
    const nextId = others.includes(typed) ? screenIdFor(typed, others) : typed;

    // Rename the screen and repoint every footer that navigated to it, in one
    // commit, so the routing model can never hold a stale id.
    this.withScreens(
      this.screens().map((row) => ({
        ...row,
        id: row.id === screen.id ? nextId : row.id,
        nextScreenId: row.nextScreenId === screen.id ? nextId : row.nextScreenId,
      })),
    );
    this.selectedScreenId.set(nextId);
  }

  protected setSubtitle(subtitle: string): void {
    const screen = this.selectedScreen();
    if (!screen) {
      return;
    }
    this.patchScreen(screen.id, { subtitle: subtitle || null });
  }

  protected setFooterLabel(footerLabel: string): void {
    const screen = this.selectedScreen();
    if (!screen) {
      return;
    }
    this.patchScreen(screen.id, { footerLabel });
  }

  protected setNextScreen(nextScreenId: string): void {
    const screen = this.selectedScreen();
    if (!screen) {
      return;
    }
    this.patchScreen(screen.id, {
      nextScreenId: nextScreenId || null,
      terminal: !nextScreenId,
    });
  }

  /* ── Component edits ──────────────────────────────────────────── */

  protected selectField(fieldId: string): void {
    this.selectedFieldId.set(fieldId);
  }

  protected addField(type: WaFormComponentType): void {
    const screen = this.selectedScreen();
    if (!screen) {
      return;
    }
    if (screen.fields.length >= MAX_COMPONENTS_PER_SCREEN) {
      this.error.set(`Meta allows ${MAX_COMPONENTS_PER_SCREEN} components on a screen.`);
      return;
    }

    const taken = screen.fields.map((field) => field.name).filter(Boolean);
    const fresh = makeField(type, taken, screen.fields.length + 1);
    this.patchScreen(screen.id, { fields: [...screen.fields, fresh] });
    this.selectedFieldId.set(fresh.id);
  }

  protected moveField(fieldId: string, direction: -1 | 1): void {
    const screen = this.selectedScreen();
    if (!screen) {
      return;
    }

    const fields = [...screen.fields];
    const index = fields.findIndex((field) => field.id === fieldId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= fields.length) {
      return;
    }

    const [moved] = fields.splice(index, 1);
    fields.splice(target, 0, moved as WaFormField);
    this.patchScreen(screen.id, { fields });
  }

  protected askRemoveField(field: WaFormField): void {
    this.pendingDeleteField.set(field);
  }

  protected removeField(): void {
    const field = this.pendingDeleteField();
    this.pendingDeleteField.set(null);
    const screen = this.selectedScreen();
    if (!field || !screen) {
      return;
    }

    this.patchScreen(screen.id, {
      fields: screen.fields.filter((candidate) => candidate.id !== field.id),
    });
    this.selectedFieldId.set(null);
  }

  protected patchField(fieldId: string, patch: Partial<WaFormField>): void {
    const screen = this.selectedScreen();
    if (!screen) {
      return;
    }

    this.patchScreen(screen.id, {
      fields: screen.fields.map((field) => (field.id === fieldId ? { ...field, ...patch } : field)),
    });
  }

  /** Retyping the label keeps the data key in step until it is edited. */
  protected setFieldLabel(field: WaFormField, label: string): void {
    const automatic = !field.name || field.name === slugFor(field.label);
    this.patchField(field.id, {
      label,
      ...(automatic && componentSpec(field.type).collects ? { name: slugFor(label) } : {}),
    });
  }

  protected setFieldRequired(field: WaFormField, required: boolean): void {
    this.patchField(field.id, { required });
  }

  protected addOption(field: WaFormField): void {
    const options = field.options ?? [];
    const next = options.length + 1;
    this.patchField(field.id, {
      options: [...options, { id: `option_${next}`, title: `Option ${next}` }],
    });
  }

  protected removeOption(field: WaFormField, optionId: string): void {
    this.patchField(field.id, {
      options: (field.options ?? []).filter((option) => option.id !== optionId),
    });
  }

  protected patchOption(
    field: WaFormField,
    optionId: string,
    patch: { id?: string; title?: string },
  ): void {
    this.patchField(field.id, {
      options: (field.options ?? []).map((option) =>
        option.id === optionId ? { ...option, ...patch } : option,
      ),
    });
  }

  /* ── Save / publish ───────────────────────────────────────────── */

  protected async save(): Promise<WhatsAppFlowForm | null> {
    const draft = this.draft();
    if (!draft) {
      return null;
    }
    if (!draft.name.trim()) {
      this.error.set('Give the form a name before saving.');
      return null;
    }

    this.saving.set(true);
    this.error.set(null);
    try {
      const saved = await this.data.saveWhatsAppFlow({
        id: draft.id ?? undefined,
        name: draft.name,
        category: draft.category,
        screens: draft.screens,
        linkedFlowId: draft.linkedFlowId,
      });

      this.draftOverride.set({
        id: saved.id,
        name: saved.name,
        category: saved.category,
        screens: saved.screens,
        linkedFlowId: saved.linkedFlowId,
      });
      this.notice.set(`${saved.name} saved as a draft.`);
      return saved;
    } finally {
      this.saving.set(false);
    }
  }

  /** Save first, then publish — one click, but never a publish without a save. */
  protected async saveAndPublish(): Promise<void> {
    const saved = await this.save();
    if (!saved) {
      return;
    }

    const outcome = await this.data.setWaFormStatus(saved.id, 'published');
    if (outcome.error) {
      this.error.set(outcome.error);
      return;
    }

    this.notice.set(`${saved.name} is published and sendable.`);
  }

  protected async copyJson(): Promise<void> {
    const clipboard = (globalThis as { navigator?: Navigator }).navigator?.clipboard;
    if (!clipboard) {
      this.error.set('This browser blocks clipboard access — select the JSON instead.');
      return;
    }

    try {
      await clipboard.writeText(this.json());
      this.jsonCopied.set(true);
    } catch {
      this.error.set('The clipboard refused the copy.');
    }
  }

  /** Downloadable flow JSON, the way the Flows API expects it as a string. */
  protected downloadJson(): void {
    const view = this.document.defaultView;
    if (!view || typeof view.URL?.createObjectURL !== 'function') {
      this.error.set('This browser cannot build a download.');
      return;
    }

    const draft = this.draft();
    if (!draft) {
      return;
    }

    const blob = new Blob([this.json()], { type: 'application/json' });
    const url = view.URL.createObjectURL(blob);
    const anchor = this.document.createElement('a');
    anchor.href = url;
    anchor.download = `${slugFor(draft.name || 'whatsapp-form')}-flow.json`;
    anchor.click();
    view.URL.revokeObjectURL(url);
  }

  protected dismiss(): void {
    this.notice.set(null);
    this.error.set(null);
    this.jsonCopied.set(false);
  }

  /** Route guard for the not-found branch: an id that resolves to nothing. */
  protected readonly missing = computed(() => Boolean(this.id()) && !this.stored());
}
