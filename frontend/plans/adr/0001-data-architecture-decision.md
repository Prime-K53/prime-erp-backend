# ADR 0001 — Data Architecture Decision (v1 Production)

## Status
- Accepted

## Context
- Prime ERP currently runs most modules against local IndexedDB, with a Node/Express backend primarily used for the Examination module and Document Engine.
- Production requirements include multi-user correctness, server-enforced authorization, durable audit logs, secure backups, and integration APIs.

## Decision
- Adopt **Option A: Centralized Server of Record** as the v1 production posture.
- Keep IndexedDB as an optional cache and offline workspace, but not as the authoritative store for cross-user accounting, inventory, and sales transactions.

## Rationale
- Multi-user inventory and ledger correctness requires a single transactional authority.
- Auditability and compliance expectations (immutable logs, field-level deltas, operator controls) are significantly easier to guarantee server-side.
- Integrations (webhooks, OpenAPI, API keys, rate limits) align naturally with a server-of-record model.

## Consequences
- Requires building domain APIs and moving critical workflows off the client DB:
  - Sales checkout (inventory deduction + ledger posting)
  - Customer payments + allocation
  - Procurement approval and GRN flows
- Requires schema migrations and a formal DB strategy (recommended: Postgres for production).
- Requires a sync strategy if offline operation must remain first-class:
  - client caching and queued writes with idempotency keys
  - explicit conflict rules for non-transactional entities (e.g., item catalog)

## Implementation Plan (First 3 Milestones)
1. Introduce server authentication and RBAC middleware.
2. Add server endpoints for Sales checkout and Ledger posting with idempotency.
3. Replace client-side atomic transaction execution for Sales with server calls and offline queuing.

## Related Documents
- [production-readiness-roadmap.md](file:///d:/Application/Prime%20ERP%20System/plans/production-readiness-roadmap.md)

