import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { WorkspaceContext } from '../workspace/workspace-context';
import type { ResolvedWorkspace } from '../workspace/workspace.model';
import { MockDataService } from './mock-data.service';

/**
 * Wave 6 data layer: the flow graph behind each flow, the publish path and the
 * append-only version history.
 */
describe('MockDataService (flow builder / wave 6)', () => {
  let data: MockDataService;
  let tenantId: string;
  let flowId: string;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.resetTestingModule();

    const resolution = signal<ResolvedWorkspace>({
      kind: 'client',
      slug: 'nazeel',
      host: 'nazeel.localhost',
      source: 'subdomain',
    });

    TestBed.configureTestingModule({
      providers: [
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
            displayName: computed(() => 'Nazeel Silks & Bridal'),
            canOverride: computed(() => true),
            setDevWorkspace: () => {},
          },
        },
      ],
    });

    data = TestBed.inject(MockDataService);
    tenantId = data.currentTenant()?.id as string;
    flowId = data.flows()[0]?.id as string;
  });

  it('seeds one graph per flow with the five engine nodes wired up', () => {
    for (const flow of data.flows()) {
      const graph = data.graphFor(flow.id);
      expect(graph, flow.id).not.toBeNull();

      const kinds = graph?.nodes.map((node) => node.kind) ?? [];
      expect(kinds).toEqual(['inbound', 'menu', 'selection', 'router', 'close']);

      const byId = new Set(graph?.nodes.map((node) => node.id));
      for (const node of graph?.nodes ?? []) {
        for (const option of node.options) {
          if (option.nextNodeId) {
            expect(byId.has(option.nextNodeId), `${node.id} → ${option.nextNodeId}`).toBe(true);
          }
        }
        if (node.nextNodeId) {
          expect(byId.has(node.nextNodeId), `${node.id} auto → ${node.nextNodeId}`).toBe(true);
        }
      }
    }
  });

  it('keeps graphs tenant-scoped', () => {
    expect(data.flowGraphs().every((graph) => graph.tenantId === tenantId)).toBe(true);
    expect(data.flowVersions().every((version) => version.tenantId === tenantId)).toBe(true);
  });

  it('has one published version per bump, newest snapshot matching the canvas', () => {
    const flow = data.flowById(flowId)!;
    const versions = data.versionsFor(flowId);

    expect(versions.length).toBe(flow.version);
    expect(versions.map((version) => version.version)).toEqual(
      [...versions].map((version) => version.version).sort((a, b) => b - a),
    );

    const newest = versions[0]!;
    expect(newest.version).toBe(flow.version);
    expect(newest.publishedAt).toBe(flow.updatedAt);
    expect(newest.nodeCount).toBe(data.graphFor(flowId)!.nodes.length);
    expect(newest.note).toBe('Published from the canvas');

    // Older snapshots are genuinely older graphs, not copies of today's.
    const oldest = versions[versions.length - 1]!;
    if (versions.length > 1) {
      expect(oldest.nodeCount).toBeLessThanOrEqual(newest.nodeCount);
    }
  });

  it('publishes a canvas edit as the next version and audits it', async () => {
    data.actor.set({ name: 'Priya Raman', role: 'Workspace Admin', scope: 'client' });
    const before = data.flowById(flowId)!;
    const nodes = data.graphFor(flowId)!.nodes.map((node) => ({ ...node }));
    nodes[1] = { ...nodes[1]!, message: 'How can we help today?' };

    const outcome = await data.saveFlowGraph(flowId, nodes, 'Greeting tightened');

    expect(outcome).not.toBeNull();
    expect(outcome!.version.version).toBe(before.version + 1);
    expect(outcome!.version.note).toBe('Greeting tightened');
    expect(outcome!.version.author).toBe('Priya Raman');
    expect(outcome!.flow.version).toBe(before.version + 1);

    expect(data.graphFor(flowId)!.nodes[1]!.message).toBe('How can we help today?');
    expect(data.versionsFor(flowId)[0]!.note).toBe('Greeting tightened');

    const audit = data.auditForTenant(tenantId).filter((row) => row.area === 'flows');
    expect(audit.length).toBeGreaterThan(0);
    expect(audit[audit.length - 1]!.action).toContain('Greeting tightened');
  });

  it('falls back to a default note when the author leaves it blank', async () => {
    const outcome = await data.saveFlowGraph(flowId, data.graphFor(flowId)!.nodes, '   ');
    expect(outcome!.version.note).toBe('Published from the canvas');
  });

  it('takes a flow live or back to draft, with an audit row either way', async () => {
    const flow = data.flowById(flowId)!;
    const start = flow.isActive;

    await data.setFlowActive(flowId, !start);
    expect(data.flowById(flowId)!.isActive).toBe(!start);

    await data.setFlowActive(flowId, start);
    expect(data.flowById(flowId)!.isActive).toBe(start);

    const rows = data.auditForTenant(tenantId).filter((row) => row.area === 'flows');
    expect(rows.some((row) => row.action.includes('back to draft'))).toBe(true);
    expect(rows.some((row) => row.action.includes('live'))).toBe(true);
  });

  it('rolls a flow back by publishing the old nodes as a new version', async () => {
    const target = data.versionsFor(flowId).find((version) => version.version < data.flowById(flowId)!.version);
    expect(target).toBeDefined();

    const versionBefore = data.flowById(flowId)!.version;
    const restored = await data.restoreFlowVersion(flowId, target!.id);

    expect(restored).not.toBeNull();
    expect(restored!.version).toBe(versionBefore + 1);
    expect(restored!.note).toContain(`Restored v${target!.version}`);
    expect(restored!.nodes.map((node) => node.kind)).toEqual(target!.nodes.map((node) => node.kind));

    // History is append-only: the target version is still on record.
    expect(data.versionsFor(flowId).some((version) => version.id === target!.id)).toBe(true);
  });

  it('returns null for unknown flows and versions', async () => {
    expect(data.flowById('nope')).toBeNull();
    expect(data.graphFor('nope')).toBeNull();
    expect(data.versionsFor('nope')).toEqual([]);
    expect(await data.saveFlowGraph('nope', [], 'x')).toBeNull();
    expect(await data.restoreFlowVersion(flowId, 'nope')).toBeNull();
  });

  it('counts flows and campaigns against the plan limits', () => {
    const usage = data.planUsage();
    expect(usage.flows).toBe(data.flows().length);
    expect(usage.campaignsPerMonth).toBe(
      data.campaigns().filter((campaign) => campaign.status !== 'draft').length,
    );
  });
});
