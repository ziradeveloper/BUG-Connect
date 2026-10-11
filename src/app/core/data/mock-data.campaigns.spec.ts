import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { WorkspaceContext } from '../workspace/workspace-context';
import type { ResolvedWorkspace } from '../workspace/workspace.model';
import { buildDataset } from './mock-data';
import { MockDataService } from './mock-data.service';

/**
 * Wave 6 data layer: broadcast wiring, the delivery series the monitor charts
 * and the send lifecycle (create → start → tick → pause/complete).
 */
describe('MockDataService (campaigns / wave 6)', () => {
  let data: MockDataService;
  let tenantId: string;

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
  });

  it('wires every seeded campaign to a template, a segment and an author', () => {
    for (const campaign of buildDataset().campaigns) {
      expect(campaign.createdBy, campaign.id).toBeTruthy();
      expect(campaign.createdAt, campaign.id).toBeTruthy();
      expect(campaign.segmentId, campaign.id).toBeTruthy();

      if (campaign.status === 'draft') {
        // A seeded draft still carries the counters of the send it stands in for;
        // what must never happen is a draft pointing at a template.
        expect(campaign.templateId).toBeNull();
      } else {
        expect(campaign.templateId, campaign.id).toBeTruthy();
      }

      // Counters stay internally consistent: nothing is read before it is sent.
      expect(campaign.delivered).toBeLessThanOrEqual(campaign.sent);
      expect(campaign.read).toBeLessThanOrEqual(campaign.delivered);
      expect(campaign.failed).toBeLessThanOrEqual(campaign.sent);
    }
  });

  it('seeds an ascending delivery series that ends on the campaign counters', () => {
    const dataset = buildDataset();

    for (const campaign of dataset.campaigns) {
      const samples = dataset.campaignSamples
        .filter((sample) => sample.campaignId === campaign.id)
        .sort((a, b) => a.at.localeCompare(b.at));

      if (campaign.sent === 0) {
        expect(samples, campaign.id).toEqual([]);
        continue;
      }

      expect(samples.length, campaign.id).toBeGreaterThan(1);

      let previous = 0;
      for (const sample of samples) {
        expect(sample.sent).toBeGreaterThanOrEqual(previous);
        expect(sample.delivered).toBeLessThanOrEqual(sample.sent);
        previous = sample.sent;
      }

      const last = samples[samples.length - 1]!;
      expect(last.sent).toBe(campaign.sent);
      expect(last.delivered).toBe(campaign.delivered);
      expect(last.read).toBe(campaign.read);
    }
  });

  it('keeps campaigns and samples inside the workspace', () => {
    for (const campaign of data.campaigns()) {
      expect(campaign.tenantId).toBe(tenantId);
      for (const sample of data.samplesFor(campaign.id)) {
        expect(sample.tenantId).toBe(tenantId);
      }
    }

    expect(data.campaignById('tenant-2-camp-1')).toBeNull();
    expect(data.samplesFor(null)).toEqual([]);
  });

  it('reports rates against the step before them', () => {
    const campaign = data.campaigns().find((row) => row.sent > 0)!;
    const metrics = data.campaignMetrics(campaign.id)!;

    expect(metrics.progress).toBe(
      Math.round((campaign.sent / campaign.audienceSize) * 100),
    );
    expect(metrics.deliveryRate).toBe(Math.round((campaign.delivered / campaign.sent) * 100));
    expect(metrics.remaining).toBe(campaign.audienceSize - campaign.sent);
    expect(data.campaignMetrics('nope')).toBeNull();
  });

  it('creates a broadcast as a draft, or scheduled when a time is given', async () => {
    const draft = await data.createCampaign({
      name: 'Pongal preview',
      segmentId: data.segments()[0]?.id ?? null,
      templateId: data.templates()[0]?.id ?? null,
      pacePerHour: 250,
      scheduledAt: null,
      audienceSize: 120,
    });

    expect(draft.status).toBe('draft');
    expect(draft.sent).toBe(0);
    expect(draft.audienceSize).toBe(120);

    const scheduled = await data.createCampaign({
      name: 'Pongal preview (scheduled)',
      segmentId: data.segments()[0]?.id ?? null,
      templateId: data.templates()[0]?.id ?? null,
      pacePerHour: 500,
      scheduledAt: new Date(Date.now() + 86_400_000).toISOString(),
      audienceSize: 40,
    });

    expect(scheduled.status).toBe('scheduled');
    expect(
      data
        .auditForTenant(tenantId)
        .filter((event) => event.area === 'campaigns')
        .some((event) => event.action.includes('Pongal preview')),
    ).toBe(true);
  });

  it('refuses to start a broadcast with no template or no audience', async () => {
    const empty = await data.createCampaign({
      name: 'Empty send',
      segmentId: null,
      templateId: null,
      pacePerHour: 250,
      scheduledAt: null,
      audienceSize: 0,
    });

    expect(await data.startCampaign(empty.id)).toBeNull();
    expect(data.campaignById(empty.id)?.status).toBe('draft');
  });

  it('advances a running broadcast one paced batch per tick and completes it', async () => {
    const campaign = await data.createCampaign({
      name: 'Tick test',
      segmentId: data.segments()[0]?.id ?? null,
      templateId: data.templates()[0]?.id ?? null,
      // 1200/hour is a batch of ten per tick, so six recipients finish at once.
      pacePerHour: 1200,
      scheduledAt: null,
      audienceSize: 6,
    });

    const started = await data.startCampaign(campaign.id);
    expect(started?.status).toBe('sending');

    const samplesBefore = data.samplesFor(campaign.id).length;
    const afterFirst = await data.tickCampaign(campaign.id);

    expect(afterFirst!.sent).toBeGreaterThan(0);
    expect(afterFirst!.delivered).toBeLessThanOrEqual(afterFirst!.sent);
    expect(afterFirst!.read).toBeLessThanOrEqual(afterFirst!.delivered);
    expect(data.samplesFor(campaign.id).length).toBe(samplesBefore + 1);

    // A six-recipient audience with a ten-per-tick batch finishes immediately.
    expect(afterFirst!.status).toBe('completed');
    expect(afterFirst!.sent).toBe(6);

    // Ticking a finished broadcast changes nothing and writes no sample.
    const settled = await data.tickCampaign(campaign.id);
    expect(settled?.sent).toBe(6);
    expect(data.samplesFor(campaign.id).length).toBe(samplesBefore + 1);
    expect(
      data
        .auditForTenant(tenantId)
        .some((event) => event.action.includes('Completed Tick test')),
    ).toBe(true);
  });

  it('pauses a running broadcast and keeps what already went out', async () => {
    const campaign = await data.createCampaign({
      name: 'Pause test',
      segmentId: data.segments()[0]?.id ?? null,
      templateId: data.templates()[0]?.id ?? null,
      pacePerHour: 1200,
      scheduledAt: null,
      audienceSize: 4000,
    });

    await data.startCampaign(campaign.id);
    const afterTick = await data.tickCampaign(campaign.id);
    expect(afterTick!.sent).toBeGreaterThan(0);

    const paused = await data.pauseCampaign(campaign.id);
    expect(paused?.status).toBe('paused');
    expect(paused?.sent).toBe(afterTick!.sent);

    // A paused campaign does not advance, and pausing twice is a no-op.
    const frozen = await data.tickCampaign(campaign.id);
    expect(frozen?.sent).toBe(afterTick!.sent);
    expect(await data.pauseCampaign(campaign.id)).toBeNull();
  });

  it('reschedules a draft but never a completed broadcast', async () => {
    const draft = await data.createCampaign({
      name: 'Reschedule test',
      segmentId: null,
      templateId: data.templates()[0]?.id ?? null,
      pacePerHour: 250,
      scheduledAt: null,
      audienceSize: 10,
    });

    const at = new Date(Date.now() + 3_600_000).toISOString();
    const scheduled = await data.scheduleCampaign(draft.id, at);
    expect(scheduled?.status).toBe('scheduled');
    expect(scheduled?.scheduledAt).toBe(at);

    await data.startCampaign(draft.id);
    await data.tickCampaign(draft.id);
    expect(await data.scheduleCampaign(draft.id, at)).toBeNull();
  });
});
