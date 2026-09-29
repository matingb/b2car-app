# Mode: PLAN

The purpose of PLAN is to produce a self-contained implementation plan that another Codex session can execute without access to the planning conversation.

## Inputs

Read:

1. The Linear issue.
2. Relevant related Linear issues when they materially affect the requirement.
3. `AGENTS.md`.
4. Relevant repository code.
5. Existing tests, migrations, schemas, API contracts, and architectural patterns.

Do not assume that the Linear issue contains all implementation details.

Inspect the current repository before deciding how the change should be implemented.

## Analysis

Determine:

* current behavior;
* desired behavior;
* affected layers;
* relevant existing abstractions;
* database impact;
* backend/API impact;
* frontend impact;
* authorization and security impact;
* validation requirements;
* migration requirements;
* compatibility concerns;
* tests that need to be added or modified;
* likely regressions;
* dependencies on other issues.

Prefer existing project patterns over introducing new abstractions.

Do not expand the functional scope beyond the Linear issue unless required for correctness.

If the issue is ambiguous but the repository clearly establishes an existing pattern, follow that pattern and document the assumption.

## Output

Create:

`.codex-work/<ISSUE_ID>/PLAN.md`

The plan must be understandable without access to the planning conversation.

Use this structure:

```markdown
# <ISSUE_ID> — Implementation Plan

## Objective

Brief explanation of the functional change.

## Source

Linear issue: <ISSUE_ID>

## Current behavior

Describe how the relevant system currently works.

## Desired behavior

Describe the behavior required by the issue.

## Relevant code

List the main files, modules, tables, routes, components, services, or other areas involved.

Explain why each is relevant.

## Implementation strategy

### 1. Database

Required schema, migration, constraint, function, policy, or query changes.

Use "No changes required" when applicable.

### 2. Backend

Required endpoints, services, validations, authorization, transactions, or business logic changes.

### 3. Frontend

Required components, hooks, state, validation, navigation, or UI behavior changes.

### 4. Cross-cutting concerns

Authentication, authorization, tenancy, concurrency, caching, observability, compatibility, or other relevant concerns.

## Implementation sequence

Ordered steps the implementation agent should follow.

## Edge cases

List important edge cases and expected behavior.

## Validation

Specify concrete validation commands and scenarios.

Examples:

- typecheck;
- lint;
- unit tests;
- integration tests;
- build;
- manual scenarios.

## Acceptance checklist

- [ ] Functional requirement 1
- [ ] Functional requirement 2
- [ ] Relevant regression scenario
- [ ] Required automated validation passes
```

## PLAN completion criteria

Before finishing PLAN mode verify that:

* every acceptance criterion from Linear is represented;
* affected layers have been inspected;
* relevant existing implementation patterns were identified;
* validation is concrete;
* the plan does not depend on information that exists only in the current conversation.

Do not implement production changes in PLAN mode.
