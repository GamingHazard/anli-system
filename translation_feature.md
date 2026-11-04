# ERP English and Simplified Chinese Translation Plan

## Objective

Implement English (`en`) and Simplified Chinese (`zh-CN`) localization across the complete ERP professionally, with immediate locale switching, deterministic core translations, local number/date/currency formatting, and a controlled server-side API fallback for approved dynamic text.

## Architecture

- **Frontend localization:** Adopt `next-intl` and structured locale dictionaries for all static ERP interface text.
- **Locale state:** Persist the selected locale in an HTTP cookie for server rendering and in browser storage for backward compatibility, with `en` as the fallback.
- **Backend fallback:** Add an authenticated `/api/translations` endpoint that accepts text batches, uses MongoDB as a persistent cache, and calls DeepL only for cache misses.
- **Security:** Keep the translation provider key in backend environment variables, enforce authentication, validate payloads, apply rate limits, and prevent browser-side API credentials.
- **Coverage boundary:** Never machine-translate financial values, identifiers, names, account data, legal language, audit evidence, payroll calculations, or other compliance-sensitive text. These use reviewed static translations.

## Implementation phases

### 1. Translation foundation and tooling

- Replace the discarded custom localization prototype with `next-intl`.
- Configure locale dictionaries under `messages/en.json` and `messages/zh-CN.json`.
- Create locale-aware client/server providers without changing existing route structure.
- Add cookie persistence, locale initialization, document language metadata, and a single language toggle in the workspace header.
- Define CI validation that detects missing keys, unused English keys, malformed ICU messages, and duplicate translation IDs.

### 2. Enterprise-aware formatting

- Centralize locale-aware formatting for dates, times, quantities, numbers, currency, and timezone display.
- Configure Simplified Chinese date/currency conventions while preserving stored values and calculation precision.
- Add locale handling to generated invoices, receipts, reports, exports, PDFs, print layouts, and email templates.
- Preserve source values in the data layer and format only at presentation boundaries.

### 3. Static interface localization

Localize in dependency order:

1. Authentication, session expiration, password change, and shared error states.
2. Workspace shell, sidebar, header, breadcrumbs, notifications, and user menus.
3. Dashboard and common tables, cards, filters, pagination, empty states, and dialogs.
4. Sales, orders, invoicing, receipts, credit sales, and customers.
5. Employees, attendance, payroll, advances, leave, disciplinary, and approvals.
6. Expenses, inventory, raw materials, production, assets, company profile, users, audit, backup, and security settings.

Existing English string literals must become stable namespaced keys rather than concatenated sentences. Dynamic values will use typed interpolation and ICU plural/select syntax.

### 4. Backend translation service

- Add provider-neutral translation configuration to backend environment validation and `.env.example`.
- Add an authenticated, password-change-compliant Express route mounted under `/api/translations`.
- Add strict request validation for `en`/`zh-CN`, text count, text length, batch size, provider status, and invalid payloads.
- Implement a MongoDB translation-cache model keyed by the hash of source text, source locale, target locale, provider, and translation version.
- Batch cache misses to the provider and persist successful provider results.
- Add provider timeout, bounded retries, structured failure handling, and no credential logging.
- Support manual review status for API-generated translations.

### 5. Dynamic content workflow

- Use API translation only for a defined allowlist of user-authored narrative fields such as notes, comments, and optional descriptions.
- Extract dynamic text for batch translation through the backend endpoint.
- Cache approved translations and fall back to English only when translation is unavailable or fails.
- Add an admin review workflow for sensitive, prominent, or persistent dynamic content.
- Never translate names, identifiers, monetary data, URLs, product codes, or other structured values.

### 6. Terminology and translation quality

- Establish a bilingual ERP glossary for recurring domain terms in sales, finance, HR, inventory, payroll, and compliance.
- Provide a preferred-term list or glossary to the provider where supported.
- Keep reviewed Chinese copies for business-critical UI and document text rather than relying on runtime API output.
- Add contextual source screenshots or descriptions when translators are brought into a review process.

### 7. Testing and release safety

- Unit-test locale providers, formatters, cache hashes, validation, provider error handling, and translation endpoints.
- Add frontend component tests for English/Chinese rendering, locale persistence, interpolation, and missing-key behavior.
- Integration-test unauthenticated translation requests and backend caching.
- Perform visual and print QA across desktop, mobile, dialogs, tables, PDFs, and exports.
- Add telemetry for missing keys, provider failures, cache hit rate, latency, and character usage.
- Use staged rollout and provider kill-switch behavior without weakening core static localization.

## Verification criteria

- Switching languages requires no page refresh and leaves route/session state intact.
- English and Chinese locale files contain complete matching keys.
- All static visible text uses the localization system.
- Dates, currency, numbers, PDFs, reports, and exports are locale-aware.
- Dynamic translations are authenticated, cached, rate-limited, and reviewed where required.
- API credentials exist only in backend configuration.
- Automated tests and production build pass.

## Delivery approach

Work in horizontal foundations first, then module-by-module vertical slices. Review business-critical modules before lower-risk screens, and combine related frontend/backend changes in small testable increments.
