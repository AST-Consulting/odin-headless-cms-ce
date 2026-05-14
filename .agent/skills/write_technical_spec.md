---
name: write_technical_spec
description: Solution Architect creates Technical Specification with High-Level Design (HLD) and Low-Level Design (LLD) from approved Functional Requirements
---

# Skill: Write Technical Specification (HLD + LLD)

## Objective
Your goal as the Solution Architect is to take the PM's approved `Functional_Requirements.md` and produce a comprehensive `Technical_Specification.md` containing both the High-Level Design and Low-Level Design, tailored to the Odin CMS architecture.

---

## Context — Existing Stacks
- **Backend**: NestJS 10 · Mongoose 8 / MongoDB · Redis (ioredis) · BullMQ · Elasticsearch 8 · JWT (Passport) · Winston logger · Swagger · Zod · class-validator/class-transformer
- **Frontend**: Next.js 16 (App Router) · React 19 · TailwindCSS 3 · Radix UI · Zustand · React Query (TanStack) · Zod · react-hook-form · Recharts · Lucide icons

---

## Instructions

### 1. Analyze Functional Requirements
- Read the approved `Functional_Requirements.md` thoroughly.
- Map each user story to technical components.
- Identify which existing modules are affected vs new modules needed.

### 2. Draft the Technical Specification
Create `Technical_Specification.md` with these sections:

---

#### Part A: High-Level Design (HLD)

##### A.1 System Overview
- Architecture diagram (described in text or Mermaid) showing how the new feature fits into the existing system.
- Component interaction flow.
- Integration points with existing modules.

##### A.2 Technology Decisions
- Any new libraries or tools needed and justification.
- Caching strategy (Redis patterns).
- Queue/async processing strategy (BullMQ jobs).
- Search strategy (Elasticsearch mappings).

##### A.3 Data Flow
- Request/response flow from UI → API → Database.
- Event/queue flows for async operations.
- Third-party integration flows.

##### A.4 Non-Functional Requirements
- Performance targets (response time, throughput).
- Security requirements (auth, authorization, input validation).
- Scalability considerations.
- Error handling strategy.

##### A.5 User Story → Component Mapping
| User Story | Backend Module | Frontend Component | Data Model |
|---|---|---|---|
| US-001 | `feature.service.ts` | `FeaturePage.tsx` | `Feature` schema |

---

#### Part B: Low-Level Design (LLD)

##### B.1 Backend Architecture (`backend/src/`)

**New/Modified Modules**: For each NestJS module, specify:
- Controller routes (method, path, guards, decorators)
- Service methods (signatures, business rules, error cases)
- Mongoose Schemas (collection name, fields with types, indexes, virtuals, relationships)
- **DTOs** — Explicit `CreateDto`, `UpdateDto`, `QueryDto`, `ResponseDto` classes with `class-validator` decorators
- Interfaces — TypeScript interfaces for internal use

**Shared Infrastructure**: Any additions to `src/core/` (guards, decorators, middlewares, utils).

**Queue Jobs**: BullMQ processor definitions if async work is needed.

**Search**: Elasticsearch index mappings if search is involved.

##### B.2 Frontend Architecture (`frontend/src/`)
- **Routes**: New `app/` directory pages/layouts.
- **Components**: New or modified components grouped by feature, with props interface.
- **State**: Zustand store slices or React Query queries/mutations.
- **Forms**: Zod schemas + react-hook-form integration.
- **API Integration**: Endpoints consumed via `src/lib/api.ts`.

##### B.3 Data Models & DTOs
- Full MongoDB schema definitions with field types, required flags, defaults, and indexes.
- Matching DTO class definitions showing validation decorators.
- Mapping notes between DTO fields and schema fields where naming differs.

##### B.4 API Contract
REST endpoint table:

| Method | Path | Auth | Request DTO | Response DTO | Description |
|---|---|---|---|---|---|
| POST | `/api/feature` | JWT | `CreateFeatureDto` | `FeatureResponseDto` | Create new feature |

##### B.5 Design Patterns & Best Practices
- Explicitly require **SOLID**, **KISS**, **DRY**, **YAGNI**.
- Require DTO ↔ Schema separation.
- Require proper error handling (NestJS exception filters, frontend error boundaries).
- Security patterns (guards, sanitization, rate limiting).

##### B.6 Security & Dependencies
- Identify any new libraries needed and evaluate their security posture.
- **NEVER use `xlsx`** (SheetJS free version) due to unpatchable vulnerabilities. **Always specify `exceljs`** for Excel handling.
- Reject any dependency that brings in excessive or known vulnerable sub-dependencies.

---

### 3. Request Approval
- Stop and wait for the user to type **"Approved"** or provide feedback.
- If feedback is given, revise the spec and re-submit.
- Loop until the user approves.

---

## Rules
- Do NOT write production code. Only provide design blueprints.
- Do NOT modify the Functional Requirements.
- Ensure every user story from the FRD maps to at least one technical component.
- The specification must be detailed enough for the Full-Stack Developer to implement without asking questions.
