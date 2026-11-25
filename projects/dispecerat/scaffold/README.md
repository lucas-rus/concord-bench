# Dispecerat — Bucharest Field-Service Dispatch Engine

Pure TypeScript (`strict: true`, Node 20 ESM) core engine for **CON-INSTAL ENGINEERING** field operations in Bucharest: electrical (`electric`), sanitary (`sanitare`), heating (`termice`), HVAC (`climatizare`), and refrigeration (`frigorific`) dispatches, multi-day projects, client accounts, Proces Verbal (`PV`) reports, and SLA tracking.

## Architecture & Module Layout

All internal imports use the `@/` root path alias (configured in `tsconfig.json` and supported at test runtime by `scripts/ts-alias.mjs`), e.g. `import type { Task } from "@/lib/types"`.

- `lib/types.ts` — Shared domain types and interfaces (`Employee`, `Task`, `Client`, `Project`, `WorkReport`, `OpsState`, plus feature types).
- `lib/demo/fixture.ts` — Deterministic Bucharest seed fixture (`buildFixture(now)`, `conversationFor(task, techNote)`, ID helpers `employeeId`, `taskId`, `projectId`, `clientId`).
- `lib/demo/mock-server.ts` — Stateful in-memory `DemoBackend` coordinating technicians, tasks, shifts, candidate rankings, projects, clients, PV work reports, and SLA alerts.
- `lib/skills.ts` — Trade areas, skill levels, severity metadata, and Romanian labels.
- `lib/matching.ts` — Technician eligibility (`activeProjectFor`, `skillFit`, `eligibleFor`).
- `lib/geo.ts` — Bucharest coordinates, Haversine distance, and time-of-day driving ETA estimation.
- `lib/clients.ts` — Client key normalization, client resolution, and PV template helpers.
- `lib/report.ts` — Proces Verbal (`PV`) report numbering, WhatsApp technician notes, drafts, and timelines.
- `lib/project-timing.ts` — Multi-day / intra-day project phase & progress calculations.
- `lib/format.ts` — Phone formatting, location freshness bands, and task SLA status calculation.

## Determinism & Testing

- Keep all functions synchronous and deterministic (accept explicit `now` / `at` timestamps instead of `setTimeout` or background timers).
- Run strict TypeScript compilation + all unit tests (`tests/*.test.ts`) with:

```bash
./scripts/run-tests.sh
```

Write unit tests for your feature in `tests/<your-feature>.test.ts` using `node:test` and `node:assert/strict`. Do not break existing tests or peer modules.
