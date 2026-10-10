import { PLAN_MODULES } from '../authorization/role.seed';
import type { MetaAppConfig, Plan, PlanTier } from './entities';

/**
 * The commercial model, seeded. Limits are editable at `/plans/edit` and the
 * module rows at `/plans/matrix`; both write back to `MockDataService.plans`,
 * which is what `PermissionService.planModules` gates the client sidebar on.
 *
 * Prices stay `null` on purpose: the PRD publishes no price list, so the UI
 * shows "Custom" instead of inventing numbers (see the Subscription stub note).
 */
export const SEED_PLANS: Plan[] = [
  {
    tier: 'Pilot',
    tagline: 'One number, one team, proving the channel works.',
    monthlyPriceInr: null,
    limits: {
      seats: 5,
      whatsappNumbers: 1,
      flows: 3,
      campaignsPerMonth: 5,
      contacts: 1000,
      messagesPerMonth: 5000,
    },
    modules: [...(PLAN_MODULES['Pilot'] ?? [])],
    supportSla: 'Email support, next business day',
  },
  {
    tier: 'Growth',
    tagline: 'Automation, campaigns and reporting for a full store.',
    monthlyPriceInr: null,
    limits: {
      seats: 25,
      whatsappNumbers: 3,
      flows: 25,
      campaignsPerMonth: 50,
      contacts: 25000,
      messagesPerMonth: 100000,
    },
    modules: [...(PLAN_MODULES['Growth'] ?? [])],
    supportSla: 'Chat and email support, business hours',
  },
  {
    tier: 'Scale',
    tagline: 'Uncapped volume with a named success manager.',
    monthlyPriceInr: null,
    limits: {
      seats: null,
      whatsappNumbers: 10,
      flows: null,
      campaignsPerMonth: null,
      contacts: null,
      messagesPerMonth: null,
    },
    modules: [...(PLAN_MODULES['Scale'] ?? [])],
    supportSla: 'Dedicated manager, round the clock',
  },
];

export const PLAN_TIERS: PlanTier[] = ['Pilot', 'Growth', 'Scale'];

/** The platform's Meta app reference. Empty until the operator saves it once. */
export const SEED_META_CONFIG: MetaAppConfig = {
  appId: '',
  appSecretRef: '',
  apiVersion: 'v24.0',
  callbackUrl: 'https://console.bugconnect.example/webhooks/meta',
  verifyToken: 'BUGCONNECT-VERIFY-SEED',
  testNumber: '',
  updatedAt: null,
  updatedBy: null,
};
