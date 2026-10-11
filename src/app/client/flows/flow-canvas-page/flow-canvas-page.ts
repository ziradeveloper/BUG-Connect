import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { PermissionService } from '../../../core/authorization/permission.service';
import { MockDataService } from '../../../core/data/mock-data.service';
import type { FlowNode, FlowNodeKind } from '../../../core/data/entities';
import { formatRelative } from '../../../shared/format';
import { ConfirmDialog, PageHeader, StatusPill } from '../../../shared/ui/ui';

/** Canvas geometry. Nodes are fixed-size cards; connectors run edge to edge. */
const NODE_WIDTH = 240;
const NODE_HEIGHT = 96;
const GRID_STEP = 40;

const NODE_META: Record<FlowNodeKind, { label: string; glyph: string; blurb: string }> = {
  inbound: {
    label: 'Inbound trigger',
    glyph: '⇥',
    blurb: 'Opens when the keyword arrives.',
  },
  menu: {
    label: 'Interactive menu',
    glyph: '▤',
    blurb: 'Up to three buttons or a ten-option list.',
  },
  selection: {
    label: 'Selection',
    glyph: '◉',
    blurb: 'Records what the contact picked.',
  },
  router: {
    label: 'Weighted router',
    glyph: '⇄',
    blurb: 'Hands over to a person when the rule matches.',
  },
  close: {
    label: 'Close',
    glyph: '⏹',
    blurb: 'Ends the journey.',
  },
};

/**
 * Flow canvas (`/flows/:id/edit`, wave 6).
 *
 * A pure HTML/SVG visualiser: node cards are absolutely positioned from their
 * saved coordinates and the SVG layer draws each option as a connector, so no
 * charting or diagramming dependency is needed. Positions move with keyboard
 * nudges rather than pointer drag — the repo's rules forbid direct DOM
 * manipulation, and nudges keep the canvas usable without a mouse.
 */
@Component({
  selector: 'app-flow-canvas-page',
  imports: [RouterLink, PageHeader, StatusPill, ConfirmDialog],
  templateUrl: './flow-canvas-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FlowCanvasPage {
  private readonly data = inject(MockDataService);
  private readonly permissions = inject(PermissionService);

  /** Route parameter (`/flows/:id/edit`) fed in by component input binding. */
  readonly id = input('');

  protected readonly nodeWidth = NODE_WIDTH;
  protected readonly nodeHeight = NODE_HEIGHT;
  protected readonly kinds = Object.keys(NODE_META) as FlowNodeKind[];
  protected readonly meta = NODE_META;

  protected readonly flow = computed(() => this.data.flowById(this.id()));
  protected readonly canManage = computed(() => this.permissions.can('flows.manage', 'edit'));

  protected readonly selectedId = signal<string | null>(null);
  protected readonly pendingDelete = signal<FlowNode | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly publishing = signal(false);
  protected readonly note = signal('');

  /** The working copy. Edits touch this; Save publishes it. */
  private readonly draftOverride = signal<FlowNode[] | null>(null);

  protected readonly nodes = computed<FlowNode[]>(
    () => this.draftOverride() ?? (this.data.graphFor(this.id())?.nodes ?? []),
  );

  protected readonly dirty = computed(() => this.draftOverride() !== null);

  protected readonly selected = computed<FlowNode | null>(
    () => this.nodes().find((node) => node.id === this.selectedId()) ?? null,
  );

  protected readonly connections = computed(() => {
    const nodes = this.nodes();
    const byId = new Map(nodes.map((node) => [node.id, node]));

    const wire = (from: FlowNode, toId: string, key: string, label: string, auto: boolean) => {
      const target = byId.get(toId) as FlowNode;
      const fromX = from.x + NODE_WIDTH;
      const fromY = from.y + NODE_HEIGHT / 2;
      const toX = target.x;
      const toY = target.y + NODE_HEIGHT / 2;
      const midX = (fromX + toX) / 2;

      return {
        id: `${from.id}-${key}`,
        label,
        auto,
        path: `M ${fromX} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${toX} ${toY}`,
        labelX: midX,
        labelY: (fromY + toY) / 2 - 6,
      };
    };

    return nodes.flatMap((node) => [
      ...node.options
        .filter((option) => option.nextNodeId && byId.has(option.nextNodeId))
        .map((option) => wire(node, option.nextNodeId as string, option.id, option.label, false)),
      ...(node.nextNodeId && byId.has(node.nextNodeId)
        ? [wire(node, node.nextNodeId, 'auto', 'continues', true)]
        : []),
    ]);
  });

  protected readonly canvas = computed(() => {
    const nodes = this.nodes();
    const width = Math.max(0, ...nodes.map((node) => node.x + NODE_WIDTH)) + GRID_STEP * 2;
    const height = Math.max(0, ...nodes.map((node) => node.y + NODE_HEIGHT)) + GRID_STEP * 2;

    return { width: Math.max(width, 960), height: Math.max(height, 520) };
  });

  protected readonly latestVersion = computed(() => this.data.versionsFor(this.id())[0] ?? null);

  protected readonly updatedLabel = computed(() => {
    const flow = this.flow();
    return flow ? formatRelative(flow.updatedAt) : '';
  });

  protected kindLabel(kind: FlowNodeKind): string {
    return NODE_META[kind].label;
  }

  protected kindGlyph(kind: FlowNodeKind): string {
    return NODE_META[kind].glyph;
  }

  protected select(nodeId: string): void {
    this.selectedId.set(nodeId);
  }

  /** Add a node below the lowest card of its kind, so nothing overlaps. */
  protected addNode(kind: FlowNodeKind): void {
    const nodes = [...this.nodes()];
    const sameKind = nodes.filter((node) => node.kind === kind).length;
    const maxY = Math.max(0, ...nodes.map((node) => node.y));
    const id = `${this.id()}-node-${kind}-${Date.now().toString(36)}`;

    const fresh: FlowNode = {
      id,
      kind,
      title: sameKind ? `${NODE_META[kind].label} ${sameKind + 1}` : NODE_META[kind].label,
      message:
        kind === 'close'
          ? 'Thanks for reaching out — a team member will continue here.'
          : 'Edit this message in the panel on the right.',
      options: kind === 'menu' ? [{ id: `${id}-a`, label: 'Option 1', nextNodeId: null }] : [],
      nextNodeId: null,
      condition: kind === 'router' ? 'No agent free within 3 minutes' : null,
      x: GRID_STEP,
      y: nodes.length ? maxY + NODE_HEIGHT + GRID_STEP * 2 : GRID_STEP,
    };

    this.commit([...nodes, fresh]);
    this.selectedId.set(id);
    this.notice.set(`${NODE_META[kind].label} added — publish the canvas to keep it.`);
  }

  protected removeNode(): void {
    const node = this.pendingDelete();
    if (!node) {
      return;
    }

    this.commit(
      this.nodes()
        .filter((candidate) => candidate.id !== node.id)
        .map((candidate) => ({
          ...candidate,
          options: candidate.options.map((option) =>
            option.nextNodeId === node.id ? { ...option, nextNodeId: null } : option,
          ),
          nextNodeId: candidate.nextNodeId === node.id ? null : candidate.nextNodeId,
        })),
    );

    if (this.selectedId() === node.id) {
      this.selectedId.set(null);
    }
    this.pendingDelete.set(null);
    this.notice.set(`${node.title} removed — publish the canvas to keep it.`);
  }

  protected updateTitle(value: string): void {
    this.patchSelected({ title: value });
  }

  protected updateMessage(value: string): void {
    this.patchSelected({ message: value });
  }

  protected updateNextNode(targetId: string): void {
    this.patchSelected({ nextNodeId: targetId === '' ? null : targetId });
  }

  protected updateCondition(value: string): void {
    this.patchSelected({ condition: value });
  }

  protected updateOptionLabel(index: number, value: string): void {
    const node = this.selected();
    if (!node) {
      return;
    }

    const options = node.options.map((option, position) =>
      position === index ? { ...option, label: value } : option,
    );
    this.patchSelected({ options });
  }

  protected updateOptionTarget(index: number, targetId: string): void {
    const node = this.selected();
    if (!node) {
      return;
    }

    const options = node.options.map((option, position) =>
      position === index
        ? { ...option, nextNodeId: targetId === '' ? null : targetId }
        : option,
    );
    this.patchSelected({ options });
  }

  protected addOption(): void {
    const node = this.selected();
    if (!node || node.options.length >= 10) {
      return;
    }

    this.patchSelected({
      options: [
        ...node.options,
        { id: `${node.id}-opt-${node.options.length + 1}`, label: 'New option', nextNodeId: null },
      ],
    });
  }

  protected removeOption(index: number): void {
    const node = this.selected();
    if (!node) {
      return;
    }

    this.patchSelected({ options: node.options.filter((_, position) => position !== index) });
  }

  /** Keyboard positioning: one grid step per press, ten with shift held. */
  protected nudge(nodeId: string, dx: number, dy: number, event?: Event): void {
    const step = (event as MouseEvent | KeyboardEvent | undefined)?.shiftKey ? GRID_STEP * 4 : GRID_STEP;

    this.commit(
      this.nodes().map((node) =>
        node.id === nodeId
          ? { ...node, x: Math.max(0, node.x + dx * step), y: Math.max(0, node.y + dy * step) }
          : node,
      ),
    );
  }

  protected discard(): void {
    this.draftOverride.set(null);
    this.note.set('');
    this.notice.set('Draft discarded — the canvas is back to the published version.');
  }

  protected async publish(): Promise<void> {
    this.publishing.set(true);
    this.error.set(null);

    const flow = this.flow();
    if (!flow) {
      this.error.set('This flow no longer exists.');
      this.publishing.set(false);
      return;
    }

    const outcome = await this.data.saveFlowGraph(flow.id, this.nodes(), this.note());

    if (!outcome) {
      this.error.set('The flow could not be published.');
      this.publishing.set(false);
      return;
    }

    this.draftOverride.set(null);
    this.note.set('');
    this.notice.set(`Published ${outcome.flow.name} v${outcome.version.version}.`);
    this.publishing.set(false);
  }

  private patchSelected(patch: Partial<FlowNode>): void {
    const node = this.selected();
    if (!node) {
      return;
    }

    this.commit(
      this.nodes().map((candidate) =>
        candidate.id === node.id ? { ...candidate, ...patch } : candidate,
      ),
    );
  }

  private commit(nodes: FlowNode[]): void {
    this.draftOverride.set(nodes);
  }
}
