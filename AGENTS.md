# Project Instructions

This repository uses a modular, directory-level instructions architecture. General and cross-cutting rules live in this root file, while specialized guidelines live directly in the corresponding subdirectories and rule files:

- **Parallel Work & Worktrees**: [.agents/rules/worktrees.md](file:///Users/matias/Documents/proyectos/B2Car/b2car-app/.agents/rules/worktrees.md) (Worktree lifecycle, branch isolation, and parallel safety).
- **Backend API & Data Architecture**: [src/app/api/AGENTS.md](file:///Users/matias/Documents/proyectos/B2Car/b2car-app/src/app/api/AGENTS.md) (Routes, Services, Repositories, Error Handling, Testing).
- **Database, Migrations & Grants**: [supabase/AGENTS.md](file:///Users/matias/Documents/proyectos/B2Car/b2car-app/supabase/AGENTS.md) (Declarative schemas, Migrations, Supabase Data API grants, RLS).
- **UI Components & Theme**: [src/app/components/AGENTS.md](file:///Users/matias/Documents/proyectos/B2Car/b2car-app/src/app/components/AGENTS.md) (Reusable UI components, Design tokens, CSS variables, ClienteAutocomplete).
- **Formatters & Utilities**: [src/lib/AGENTS.md](file:///Users/matias/Documents/proyectos/B2Car/b2car-app/src/lib/AGENTS.md) (Currency, GMT-3 dates, Vehicles, Phone formatters).

---

## Global Logging Policy

Do not use `console.log`, `console.info`, `console.warn`, `console.error`, or `console.debug` directly in application code. Use the project logger from `@/lib/logger` instead:

```ts
import { logger } from "@/lib/logger";

logger.error("Contexto de la falla", error);
```

`src/lib/logger.ts` is the only place in the entire repository that may write directly to `console.*`. Do not log credentials, certificates, private keys, tokens, or unnecessary personal data.

---

## Session Retrospective & Feedback Protocol

At the end of a coding session (or whenever the user asks for session feedback / wrap-up), the agent must evaluate the session and provide brief, constructive feedback on these 3 areas:

- **A) Prompting Feedback**: How the user could adjust prompting, context, or constraints for better/faster outcomes (e.g. earlier link/file references, clearer acceptance criteria, specific error reproduction steps).
- **B) Rules & Instructions Evolution (`AGENTS.md`)**: Suggestions for refining, clarifying, adding, or modularizing rules in root or directory-level `AGENTS.md` files based on friction, repeated patterns, or ambiguity encountered during the task.
- **C) Skills Evolution**: Opportunities to create new skills for repetitive workflows, update existing skills (e.g. `implement-issue`), or deprecate confusing ones.
