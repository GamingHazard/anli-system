# Plan: Installable PWA for ANLI System

TL;DR: Turn the app into a proper installable PWA by adding a manifest, secure-hosting requirements, and a conservative service worker that caches only the app shell and safe read-only resources. Keep payroll, employee, auth, and mutation APIs out of the cache to avoid stale or sensitive data. Treat installability as a product feature and service-worker caching as a reliability enhancement, not a blanket cache for everything.

## Steps

1. Confirm the deployment basics for installability
   - Ensure the app is served over HTTPS in production.
   - Verify the app is hosted on a stable, trusted domain.
   - Confirm the app shell is served from the app’s canonical root URL.
   - This is required before any PWA install prompt can appear reliably.

2. Add the manifest and app metadata
   - Define app name, short name, description, theme color, background color, and start URL.
   - Set display mode to standalone so the app opens without browser chrome.
   - Add icon assets in at least 192x192 and 512x512 sizes, and include a maskable icon where supported.
   - Register the manifest from the root app layout so browsers can discover it automatically.

3. Add app-shell registration and install UX
   - Expose the manifest via the main layout and ensure it is reachable at /manifest.json.
   - Add an optional “Install App” button using the beforeinstallprompt event to give users a clear install path.
   - Keep install prompts user-initiated when possible to avoid intrusive browser behavior.

4. Create a minimal, safe service worker
   - Register the service worker only after the page has loaded successfully.
   - Precache only the app shell: root HTML, manifest, critical JS/CSS, and icon assets.
   - Exclude all mutation endpoints, auth endpoints, and sensitive data responses from the cache.
   - Use versioned cache names so updates are replaced cleanly without stale app-shell issues.

5. Set request-specific cache strategies
   - Static assets: cache-first or stale-while-revalidate.
   - Main HTML navigations: network-first, with graceful offline fallback.
   - Authenticated API calls: never cache by default.
   - POST/PUT/PATCH/DELETE requests: bypass cache entirely.
   - Safe read-only resources can be cached selectively, but never at the expense of stale user or payroll data.

6. Add controlled offline fallback behavior
   - Provide a small offline fallback only for the app shell or safe public pages.
   - Keep authenticated pages behind login and never cache sensitive payloads.
   - Clearly define that offline functionality is limited to shell access and safe public content unless additional offline logic is required.

7. Validate installability and runtime behavior
   - Verify that the app is served from HTTPS and the manifest loads successfully.
   - Open the app in Chrome or Edge and confirm the install prompt appears.
   - Confirm that installed app launch uses standalone mode and no browser chrome remains.
   - Verify the service worker registers and updates correctly without breaking the app shell.
   - Test that protected and sensitive API calls still go to the server rather than stale cache entries.

8. Roll out in phases
   - Phase 1: add manifest and install metadata only.
   - Phase 2: add a conservative service worker for safe shell caching.
   - Phase 3: refine offline fallback policies if product requirements justify them.
   - Keep cache versioning and cleanup in place to avoid stale UI or cache poisoning on future releases.

## Relevant files

- App shell: app/layout.tsx
- Global styling and app entry: app/globals.css
- Public assets: public
- Next config: next.config.mjs
- Project setup: package.json
- TypeScript setup: tsconfig.json

## Verification

1. Confirm the production host is HTTPS and the manifest is served successfully.
2. Open the app in Chromium and verify the install prompt appears.
3. Confirm the app launches in standalone mode after installation.
4. Verify the service worker registers successfully and caches only intended assets.
5. Test a protected route and sensitive API response to ensure they do not come from cache.
6. Validate offline shell behavior on safe pages only.
7. Run the project’s existing validation suite to avoid regressions in the app shell.

## Decisions

- Treat installability as a product requirement, not a generic browser trick.
- Use a conservative service worker because this is an ERP system with sensitive payroll and employee data.
- Do not cache auth-protected or mutation APIs by default.
- Keep offline support as a progressive enhancement, not a prerequisite for installability.

## Further considerations

1. If the production host is not HTTPS, installability will not work reliably in modern browsers.
2. If the app later needs partial offline data for a few workflows, add only safe, read-only caches with explicit data boundaries.
3. If browser prompts are inconsistent, provide a clear in-app “Install app” button as a fallback.
