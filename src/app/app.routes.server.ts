import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * No prerendering.
 *
 * Which workspace renders — the marketing site, a client console or the platform
 * console — is decided from the request's `Host` header, and `/login` also reads
 * `?next` and `?ws`. A prerendered file is one byte-for-byte response, so baking
 * any of these would hand `nazeel.localhost` the marketing page (or worse,
 * another tenant's shell). Every route therefore renders per request.
 */
export const serverRoutes: ServerRoute[] = [{ path: '**', renderMode: RenderMode.Server }];
