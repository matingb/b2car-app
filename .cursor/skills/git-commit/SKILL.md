---
name: git-commit
description: Synthesize repo changes and propose a short, readable git commit message.
---
# git-commit

Generate a short, readable **Spanish** commit message that captures the main changes.

## When to Use
- Use this skill when the user asks for a commit message, or after completing an implementation and the user says they’re ready to commit.
- Use this skill when you need to summarize changes across multiple files into one message.

## Instructions
### 1) Gather facts (never guess)
- Inspect the working tree and staging area:
  - `git status`
  - `git diff`
  - `git diff --staged`

### 2) Identify the “main change”
- Determine the primary intent (what the change *enables/fixes/improves*).
- Group related modifications into 1–3 themes (by feature/area), ignoring mechanical noise when possible.

### 3) Produce a “simple + short body” commit message (default format)
- **Title**: present tense, imperative verb, <= ~72 chars, no trailing period.
  - Good verbs: Add / Update / Fix / Refactor / Improve / Remove / Harden
- **Body** (optional): 1–3 bullets only, focusing on user impact and key implementation points.
- Prefer **balanced** content:
  - 1 strong title describing impact
  - bullets mentioning the biggest visible changes or risk-reducing details

### 4) Clarifying questions (ask only when needed)
Ask when the intent isn’t obvious from the diff:
- What’s the user-facing outcome (bug fixed vs behavior change vs refactor)?
- Any breaking change, migration, or rollout note that must be captured?
- Should this be split into separate commits?

### Examples
**Title only**
- `Fix arreglo form validation for missing fields`

**Title + short body**
- `Improve arreglo form UX and validation`
- `- Normalize field defaults and error messages`
- `- Prevent submit when required values are missing`
- `- Align payload mapping with backend expectations`