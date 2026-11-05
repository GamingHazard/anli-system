# Production Performance Remediation Plan

## Goal

Reduce the identified client/API performance risks without changing business rules or compromising audit, payroll, inventory, or workflow correctness. Establish measurable baselines first, then implement the least invasive fixes that address demonstrated bottlenecks.

This document is an implementation plan; it does not itself change application behavior.

## Scope

- Payroll run response size and payslip retrieval.
- Unbounded or large list responses and pagination.
- Customer and sales search performance.
- Per-request session/authentication and audit database overhead.
- Attendance and payroll workload limits.
- Notification outbox throughput.
- Regression, contract, and realistic-load verification.

Security findings from the earlier review—including MFA, production configuration and credentials, and client-side protected-data retention—are outside this performance plan and should remain separate release blockers.

## Agreed design decisions

- **Payroll storage:** Return summary-only run lists and paginate payslip details, while retaining embedded payslips initially. Normalize storage only if measured document size, query cost, or expected scale warrants migration.
- **Search behavior:** Preserve substring matching. Optimize its implementation using query plans and production-like data without silently changing what users can find.
- **Worker architecture:** Add durable asynchronous read-audit processing or a dedicated notification worker only if baseline measurements show the current approach misses targets.
- **Service targets:** Set p95/p99 latency, response-size, peak-concurrency, audit-delivery, and notification-backlog targets during baseline work, based on expected deployment volumes.

## Prioritized implementation plan

1. **Establish reproducible baselines.** Record API p50/p95/p99 latency, MongoDB operation counts and latency, response bytes, Node.js memory/CPU, audit-event rates, and notification backlog age. Use representative seeded datasets and a repeatable workload definition for before/after comparison. Do not log request bodies or sensitive payroll/employee data.
2. **Reduce payroll payloads without changing calculations.** Make the run-list response summary-only and retrieve payslips through a bounded, paginated detail API. Preserve payroll calculations, approvals, and audit semantics. Keep payslips embedded initially unless measurements or MongoDB document-size headroom show normalization is necessary.
3. **Bound growing list endpoints.** Add stable cursor pagination and maximum page sizes to leave requests and other large historical/unbounded list endpoints found during implementation inventory. Update client queries/screens to support next-page loading while preserving filters and ordering.
4. **Replace deep offset pagination.** Move customer and order lists to keyset/cursor pagination using stable sort keys and a unique tie-breaker. Maintain compatibility during rollout where needed, and confirm all callers migrate before removing old paging behavior.
5. **Optimize search using query-plan evidence.** Inspect representative customer and sales query plans and field usage. Add suitable indexes and select a bounded query strategy that preserves substring-search behavior. Do not assume ordinary indexes accelerate leading-wildcard regular expressions.
6. **Tune shared authentication/audit work based on measurements.** Verify supporting indexes and profile database costs. Preserve timely session revocation and reliable business-change auditing. If read-audit write volume is material, move it to a durable, monitored queue/outbox with retry and recovery rather than an in-memory fire-and-forget path.
7. **Validate workload limits.** Stress-test existing attendance and payroll caps. Keep explicit limits and clear errors; paginate or batch expensive reads/calculations only if expected valid workloads exceed safe response/resource budgets. Do not lower limits without business approval.
8. **Scale notification delivery only if needed.** Measure queue throughput, per-recipient query work, and backlog age. If the in-process poller cannot meet targets, run a dedicated worker with bounded concurrency, leases, retries, idempotency, and failed-event recovery.
9. **Verify end to end.** Add API/client contract tests for pagination and payroll summary/detail flows; test stable pagination under concurrent inserts, queue retries, and session/audit behavior; then run representative load tests and compare against agreed service targets.

## Execution sequence

Baseline and workload targets precede code changes. Payroll and list-payload reductions come first because they directly cap response and memory costs. Cursor and search work follows with query-plan evidence. Authentication/audit and notification architecture changes are conditional on measured need. Final load testing is required before considering remediation complete.

## Verification requirements

- Compare before/after p95/p99 latency, database operation count/latency, response size, memory/CPU, audit delivery, and notification backlog against the targets set during baseline work.
- Test large but valid payroll and attendance workloads, including maximum configured limits.
- Test cursor ordering, page boundaries, filtering, and behavior when records are inserted during pagination.
- Confirm payroll list summaries and paginated payslips provide all information required by client screens without changing calculations or authorization.
- Confirm substring search behavior remains consistent and evaluate common and worst-case query plans on production-like data.
- Exercise audit and notification failure/retry/recovery paths; ensure transaction boundaries and idempotency are preserved.
- Use non-sensitive synthetic test data; do not copy production personal information or credentials into load fixtures.

## Operational considerations

- Deploy index changes against production-like data and plan rollout to avoid unplanned write outages.
- Coordinate API and client pagination/response changes; retain compatibility until all callers are migrated.
- Preserve MongoDB transaction boundaries and idempotency in payroll, audit, and notification workflows.
- This plan covers performance findings only and does not resolve other security or production-readiness blockers.
