---
name: implement-issue
description: Plan, implement, review, or fix engineering work originating from a Linear issue.
---

# Linear Issue Workflow

Use this workflow for engineering work originating from Linear.

Linear is the functional source of truth.
AGENTS.md defines repository-wide engineering rules.

Work artifacts live in:

`.codex-work/<ISSUE_ID>/`

## Modes

Determine the requested mode from the user's request.

### PLAN

When planning an issue, read:

`references/plan.md`

Produce:

`.codex-work/<ISSUE_ID>/PLAN.md`

Do not implement code.

### IMPLEMENT

When implementing an existing plan, read:

`references/implement.md`

Use:

`.codex-work/<ISSUE_ID>/PLAN.md`

Implement the requested change and validate it.

### REVIEW

When reviewing an implementation, read:

`references/review.md`

Compare:

- Linear requirements
- PLAN.md
- implementation diff
- relevant surrounding code

Do not modify production code.

### FIX

When fixing review findings, read:

`references/fix.md`

Address valid findings, validate the changes, and avoid unrelated refactors.

---

# Workflow lifecycle

The expected lifecycle is:

```text
Linear issue
     │
     ▼
PLAN
     │
     │ creates PLAN.md
     ▼
IMPLEMENT
     │
     │ changes code + validates
     ▼
REVIEW
     │
     ├── PASS ───────────────► DONE
     │
     └── findings
           │
           ▼
          FIX
           │
           │ changes code + validates
           ▼
         REVIEW
           │
           └── repeat until PASS
```

Planning and implementation should normally happen in separate sessions so the implementation session starts with focused context.

Implementation and FIX should normally remain in the same session because the implementing agent already has useful context about its changes.

Review should use an independent reviewer when available.

---

# General principles

## Functional truth

Linear defines what the software should do.

Do not reinterpret clear functional requirements based solely on implementation convenience.

## Implementation truth

The repository defines what the software currently does.

Always inspect relevant code before modifying it.

## Plan

`PLAN.md` is guidance, not immutable truth.

Deviate only when justified by actual repository state or correctness concerns.

Document meaningful deviations.

## Scope discipline

Prefer the smallest complete implementation that satisfies the issue.

Do not combine unrelated technical debt work with the issue.

## Validation

An implementation is not complete simply because the code was written.

Run relevant validation.

## Handoffs

Persistent artifacts should contain enough context for the next session to operate without access to the previous conversation.

Do not rely on hidden reasoning or conversational history as part of the handoff.
