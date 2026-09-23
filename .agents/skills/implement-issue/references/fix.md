# Mode: FIX

The purpose of FIX is to address findings produced by REVIEW without unnecessarily reopening the implementation design.

## Inputs

Read:

1. current implementation;
2. review findings from the current session or `.codex-work/<ISSUE_ID>/REVIEW.md`;
3. `.codex-work/<ISSUE_ID>/PLAN.md`;
4. `AGENTS.md`;
5. the Linear issue when necessary.

## Behavior

Evaluate each finding against the code.

Fix valid findings.

Do not blindly implement a review suggestion when a better minimal correction exists.

Do not use FIX mode as an opportunity for unrelated refactoring.

If a finding is invalid because the reviewer missed relevant code or behavior:

* do not make an unnecessary change;
* explain why the finding does not apply.

If fixing a finding reveals another defect directly caused by the same implementation, fix it as part of the same task.

## Validation

After fixes:

* rerun tests relevant to the changed behavior;
* rerun validations required by `PLAN.md`;
* rerun validations required by `AGENTS.md` when applicable.

Report:

* findings fixed;
* findings rejected and why;
* validation executed;
* remaining concerns.

The implementation should then be reviewed again.