# Mode: IMPLEMENT

The purpose of IMPLEMENT is to execute an existing plan with minimal unnecessary redesign.

## Inputs

Read, in this order:

1. `AGENTS.md`
2. `.codex-work/<ISSUE_ID>/PLAN.md`
3. the Linear issue when available;
4. relevant repository code.

Treat:

* Linear as the functional source of truth;
* `PLAN.md` as the implementation strategy;
* the current repository as the source of truth for actual code state.

Do not blindly trust file paths or implementation details in the plan if the repository changed after the plan was generated.

Verify them against the current code.

## Implementation behavior

Implement the complete plan.

Prefer focused changes.

Avoid unrelated refactors, formatting changes, dependency upgrades, or cleanup.

Follow existing architectural and coding patterns.

Do not change functional requirements merely because another implementation would be easier.

If a plan step is impossible or clearly incorrect because of repository state:

1. investigate the discrepancy;
2. choose the smallest correct alternative;
3. document the deviation;
4. continue when safe.

Do not abandon the entire plan because of a minor discrepancy.

## Validation

Run all validations specified by `PLAN.md`.

Also run any validation required by `AGENTS.md`.

Fix failures caused by the implementation.

Do not hide or ignore failing validations.

Distinguish pre-existing failures from failures introduced by the current change.

## Completion

At the end report:

* what was implemented;
* files or areas materially changed;
* plan deviations;
* validations executed;
* validation results;
* any unresolved concerns.

Do not declare the issue complete if required validation has not been performed unless it cannot reasonably be executed in the current environment.
