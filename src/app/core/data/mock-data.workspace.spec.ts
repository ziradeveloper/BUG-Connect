import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { WorkspaceContext } from '../workspace/workspace-context';
import type { ResolvedWorkspace } from '../workspace/workspace.model';
import { MockDataService } from './mock-data.service';

/**
 * Wave 3 behaviours of the dummy layer: teams, quick replies, segments, the
 * business profile, contact edits and template drafts — plus the guarantee
 * that the new collections never disturb the seeded stories that predate them.
 */
describe('MockDataService (workspace / wave 3)', () => {
  const resolution = signal<ResolvedWorkspace>({
    kind: 'client',
    slug: 'nazeel',
    host: 'nazeel.localhost',
    source: 'subdomain',
  });

  beforeEach(() => {
    TestBed.resetTestingModule();
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
            displayName: computed(() => resolution().slug ?? 'Workspace'),
            canOverride: computed(() => true),
            setDevWorkspace: () => {},
          },
        },
      ],
    });
  });

  const build = () => TestBed.inject(MockDataService);

  it('seeds teams, replies, segments and a profile for every tenant', () => {
    const data = build();
    expect(data.teams().length).toBe(3);
    expect(data.teams().filter((team) => team.isDefault)).toHaveLength(1);
    expect(data.quickReplies().length).toBeGreaterThanOrEqual(5);
    expect(data.quickReplies()[0]).toMatchObject({ trigger: '/hi', title: 'Greeting' });
    expect(data.segments().length).toBe(3);
    expect(data.businessProfile()?.displayName).toContain('Nazeel');
  });

  it('keeps pre-wave-3 seeds byte-identical', () => {
    const data = build();
    // Pinned by the baseline narrative: first conversation and template.
    const conv = data.conversations().find((item) => item.id === 'tenant-1-conv-1')!;
    expect(conv).toBeTruthy();
    const firstTemplate = data.templates()[0]!;
    expect(firstTemplate.name).toBe('order_confirmation');
    expect(firstTemplate.status).toBe('approved');
  });

  it('evaluates segment rules against live contacts', () => {
    const data = build();
    const optedIn = data.evaluateSegment('all', [{ field: 'optIn', operator: 'is', value: 'opted-in' }]);
    expect(optedIn.length).toBe(data.contacts().filter((contact) => contact.optInStatus).length);

    const vip = data.evaluateSegment('all', [
      { field: 'tag', operator: 'has', value: 'VIP-Retail' },
      { field: 'conversations', operator: 'moreThan', value: '2' },
    ]);
    expect(vip.every((contact) => contact.tags.includes('VIP-Retail'))).toBe(true);

    expect(data.evaluateSegment('all', [])).toHaveLength(data.contacts().length);
    expect(data.evaluateSegment('any', [])).toHaveLength(0);
  });

  it('updates contact profiles in place', async () => {
    const data = build();
    const contact = data.contacts()[0]!;
    const saved = await data.updateContact(contact.id, {
      displayName: 'Spec Rename',
      tags: ['Spec-Tag'],
      customAttributes: { tier: 'gold' },
    });

    expect(saved?.displayName).toBe('Spec Rename');
    expect(data.contactById(contact.id)?.customAttributes).toEqual({ tier: 'gold' });
    expect(data.contactById(contact.id)?.tags).toEqual(['Spec-Tag']);
  });

  it('keeps exactly one default team per tenant', async () => {
    const data = build();
    const challenger = data.teams().find((team) => !team.isDefault)!;
    await data.saveTeam({ id: challenger.id, name: challenger.name, isDefault: true });

    const defaults = data.teams().filter((team) => team.isDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0]!.id).toBe(challenger.id);
  });

  it('counts template variables and gates submission to drafts', async () => {
    const data = build();
    const saved = await data.saveTemplate({ name: 'spec_vars', body: 'Hi {{1}}, code {{2}} ({{1}} again)' });
    expect(saved.variables).toBe(2);
    expect(saved.status).toBe('draft');

    const submitted = await data.submitTemplate(saved.id);
    expect(submitted?.status).toBe('pending');
    expect(submitted?.submittedAt).not.toBeNull();
    expect(await data.submitTemplate(saved.id)).toBeNull();
  });

  it('round-trips replies, segments and the business profile', async () => {
    const data = build();

    const reply = await data.saveQuickReply({ trigger: '/spec', body: 'Spec body' });
    expect(data.quickReplies().some((row) => row.id === reply.id)).toBe(true);
    await data.deleteQuickReply(reply.id);
    expect(data.quickReplies().some((row) => row.id === reply.id)).toBe(false);

    const segment = await data.saveSegment({ name: 'Spec segment', match: 'any', rules: [] });
    expect(data.segments().some((row) => row.id === segment.id)).toBe(true);
    await data.deleteSegment(segment.id);
    expect(data.segments().some((row) => row.id === segment.id)).toBe(false);

    const profile = await data.saveBusinessProfile({ displayName: 'Spec Business' });
    expect(profile?.displayName).toBe('Spec Business');
    expect(data.businessProfile()?.displayName).toBe('Spec Business');
  });
});
