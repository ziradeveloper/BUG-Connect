import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { MockDataService } from '../../../core/data/mock-data.service';
import type { FlowNode } from '../../../core/data/entities';
import { formatTimeOfDay } from '../../../shared/format';
import { PageHeader, StatusPill } from '../../../shared/ui/ui';

type SimTurn = { id: number; role: 'bot' | 'user' | 'note'; text: string };

/**
 * Flow simulator (`/flows/:id/simulate`, wave 6).
 *
 * Walks the published graph in a phone frame: the bot's message lands, its
 * options render as quick replies, picking one records the choice and moves the
 * conversation to that node. Nothing is written back — the simulator is a
 * read-only rehearsal of exactly the graph the canvas published.
 */
@Component({
  selector: 'app-flow-simulator-page',
  imports: [RouterLink, PageHeader, StatusPill],
  templateUrl: './flow-simulator-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FlowSimulatorPage {
  private readonly data = inject(MockDataService);

  /** Route parameter (`/flows/:id/simulate`) fed in by component input binding. */
  readonly id = input('');

  protected readonly flow = computed(() => this.data.flowById(this.id()));
  protected readonly graph = computed(() => this.data.graphFor(this.id()));
  protected readonly nodes = computed<FlowNode[]>(() => this.graph()?.nodes ?? []);

  private readonly turns = signal<SimTurn[]>([]);
  private readonly cursor = signal<string | null>(null);
  private counter = 0;

  /**
   * Reads an empty transcript as "the run just started" and shows the entry
   * message, so the server render already has the opening bubble instead of an
   * empty phone. Choosing an option writes real turns on top of this.
   */
  protected readonly transcript = computed<SimTurn[]>(() => {
    const turns = this.turns();
    if (turns.length) {
      return turns;
    }

    const entry = this.entryNode();
    return entry ? [{ id: 0, role: 'bot' as const, text: entry.message }] : [];
  });

  protected readonly current = computed<FlowNode | null>(() => {
    const id = this.cursor() ?? this.entryNode()?.id ?? null;
    return this.nodes().find((node) => node.id === id) ?? null;
  });

  /**
   * Bubble times are derived from the graph's own timestamp rather than the wall
   * clock: the server and the browser must print the same minutes or hydration
   * would flag the difference.
   */
  private readonly clock = computed(() => {
    const stamp = Date.parse(this.graph()?.updatedAt ?? '');
    return Number.isNaN(stamp) ? Date.UTC(2026, 9, 8, 12, 0) : stamp;
  });

  /** The entry node: the first `inbound`, else the first node of any kind. */
  protected readonly entryNode = computed<FlowNode | null>(
    () => this.nodes().find((node) => node.kind === 'inbound') ?? this.nodes()[0] ?? null,
  );

  protected readonly status = computed(() => {
    const node = this.current();
    if (!node) {
      return { label: 'Ended', tone: 'neutral' as const };
    }
    if (node.kind === 'close') {
      return { label: 'Handed to an agent', tone: 'success' as const };
    }
    return { label: 'In flow', tone: 'info' as const };
  });

  protected readonly visitedCount = computed(
    () =>
      new Set(
        this.transcript()
          .filter((turn) => turn.role === 'bot')
          .map((turn) => turn.text),
      ).size,
  );

  protected restart(): void {
    this.counter = 0;
    this.turns.set([]);
    this.cursor.set(this.entryNode()?.id ?? null);
  }

  protected choose(optionId: string): void {
    this.ensureStarted();
    const node = this.current();
    const option = node?.options.find((candidate) => candidate.id === optionId);
    if (!node || !option) {
      return;
    }

    this.push('user', option.label);

    const next = this.nodes().find((candidate) => candidate.id === option.nextNodeId) ?? null;
    this.cursor.set(next?.id ?? null);

    if (!next) {
      this.push('note', 'No further node is wired to that choice — the conversation ends here.');
      return;
    }

    this.push('bot', next.message);

    if (next.kind === 'close') {
      this.push('note', 'The close node hands the thread to the team with the flow context attached.');
    }
  }

  /** Run the node's automatic continuation, if it has one. */
  protected advance(): void {
    this.ensureStarted();
    const node = this.current();
    const next = this.nodes().find((candidate) => candidate.id === node?.nextNodeId) ?? null;
    if (!node || !next) {
      this.push('note', 'Nothing is wired after this node — the journey ends here.');
      return;
    }

    this.cursor.set(next.id);
    this.push('bot', next.message);
  }

  protected restartWithKeyword(): void {
    const flow = this.flow();
    this.restart();
    if (flow?.triggerKeyword) {
      this.ensureStarted();
      this.push('user', flow.triggerKeyword);
      this.push('bot', this.entryNode()?.message ?? '');
    }
  }

  protected back(): void {
    const turns = this.transcript();
    if (turns.length <= 1) {
      this.restart();
      return;
    }

    // Undo to the previous choice, mirroring "back" on the real handset.
    const lastUserIndex = turns.map((turn) => turn.role).lastIndexOf('user');
    if (lastUserIndex === -1) {
      this.restart();
      return;
    }

    this.counter = 0;
    this.turns.set(turns.slice(0, lastUserIndex));
    const botTurns = turns.slice(0, lastUserIndex).filter((turn) => turn.role === 'bot');
    const lastBot = botTurns.length ? botTurns[botTurns.length - 1] : null;
    const node = lastBot
      ? this.nodes().find((candidate) => candidate.message === lastBot.text) ?? null
      : this.entryNode();
    this.cursor.set(node?.id ?? null);
  }

  /** Bubble time for a turn: one minute per turn from the graph's own stamp. */
  protected time(turnId: number): string {
    return formatTimeOfDay(new Date(this.clock() + turnId * 60_000).toISOString());
  }

  /**
   * Materialise the derived opening bubble into the real transcript before a
   * choice mutates it, so running a step never erases the message that was
   * already on the phone.
   */
  private ensureStarted(): void {
    if (this.turns().length) {
      return;
    }

    const entry = this.entryNode();
    this.cursor.set(entry?.id ?? null);
    if (entry) {
      this.push('bot', entry.message);
    }
  }

  private push(role: SimTurn['role'], text: string): void {
    this.counter += 1;
    this.turns.update((turns) => [...turns, { id: this.counter, role, text }]);
  }
}
