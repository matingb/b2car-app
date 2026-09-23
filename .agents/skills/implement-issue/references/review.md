# Mode: REVIEW

The purpose of REVIEW is to independently determine whether the implementation correctly satisfies the Linear issue and the implementation plan.

Do not modify production code in REVIEW mode.

## Inputs

Inspect:

1. the Linear issue;
2. `.codex-work/<ISSUE_ID>/PLAN.md`;
3. `AGENTS.md`;
4. the implementation diff;
5. relevant surrounding code;
6. tests and validation results when available.

Do not review the diff in isolation.

The review must compare:

```text
LINEAR REQUIREMENTS
        ↓
IMPLEMENTATION PLAN
        ↓
CURRENT DIFF
        ↓
ACTUAL SYSTEM BEHAVIOR
```

## Review priorities

Prioritize correctness over style.

Check for:

### Requirements coverage

* missing acceptance criteria;
* partially implemented requirements;
* behavior inconsistent with Linear.

### Correctness

* incorrect business logic;
* invalid assumptions;
* broken edge cases;
* state inconsistencies;
* concurrency problems;
* transaction problems.

### Architecture

* violation of established patterns;
* duplicated logic where an existing abstraction should be used;
* inappropriate coupling;
* unnecessary complexity.

### Security

* authorization bypasses;
* tenant isolation problems;
* trusting client-controlled identifiers;
* unintended information exposure;
* missing validation.

### Database

* incorrect constraints;
* unsafe migrations;
* missing indexes when materially relevant;
* incorrect transaction boundaries;
* RLS/policy regressions;
* data integrity problems.

### Backend

* incorrect API behavior;
* validation gaps;
* inconsistent error handling;
* broken contracts.

### Frontend

* incorrect conditional behavior;
* stale state;
* validation inconsistencies;
* inaccessible or broken flows;
* mismatch with backend rules.

### Tests

* missing tests for important new behavior;
* tests that do not actually verify the requirement;
* untested regression paths.

### Scope

* unnecessary changes;
* unrelated refactors;
* accidental behavior changes.

## Findings

Only report actionable findings.

Do not report subjective stylistic preferences unless they violate an explicit project convention or create a material maintenance/correctness issue.

Classify findings as:

* P0 — critical: severe security, corruption, or system-wide failure risk;
* P1 — high: likely functional failure or important requirement violation;
* P2 — medium: real defect or meaningful regression risk;
* P3 — low: valid issue with limited impact.

For each finding provide:

* priority;
* location;
* problem;
* why it matters;
* expected behavior;
* concise fix direction.

Example:

```markdown
## P1 — Tenant ownership is not validated

Location: `app/api/example/route.ts`

The endpoint accepts `tenant_id` from the request body and uses it directly.

This allows the caller to target another tenant.

Expected behavior:
derive tenant identity from the authenticated session/JWT.

Suggested fix:
remove `tenant_id` from the client-controlled input and obtain it from the authenticated context.
```

Do not create findings merely to populate the review.

If no material issues are found, state that explicitly.

## Persistent review artifact

When review findings need to be handed to another session, write:

`.codex-work/<ISSUE_ID>/REVIEW.md`

Include:

```markdown
# <ISSUE_ID> — Review

## Result

PASS
```

or:

```markdown
# <ISSUE_ID> — Review

## Result

CHANGES REQUESTED

## Findings

### P1 — ...
...

### P2 — ...
...
```

When review results remain available in the same Codex session, creating `REVIEW.md` is optional unless explicitly requested.
