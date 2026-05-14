# Skill: Generate Code

## Objective
Your goal as the Full-Stack Engineer is to write robust, production-ready code based on the approved Technical Specification, strictly adhering to the Odin CMS architecture and design patterns.

---

## Code Quality & Design Principles

### SOLID
- **S** — Single Responsibility: One class/function = one job. Controllers don't contain business logic. Services don't construct HTTP responses.
- **O** — Open/Closed: Design modules to be extendable (decorators, strategy patterns) without modifying existing code.
- **L** — Liskov Substitution: Derived classes/interfaces must be substitutable for their base types.
- **I** — Interface Segregation: Prefer small, focused interfaces over large monolithic ones.
- **D** — Dependency Inversion: Depend on abstractions (interfaces, DI tokens), not concrete implementations. Leverage NestJS's built-in dependency injection.

### KISS
- Write the simplest solution that satisfies the spec. Avoid premature optimization and unnecessary abstraction layers.

### DRY
- Extract repeated logic into `src/core/utils/`, shared decorators, or base service classes. On the frontend, extract into `src/lib/` or shared hooks.

### YAGNI
- Only implement features explicitly defined in the spec. Do not add "nice-to-have" abstractions.

---

## Backend Implementation (`backend/src/`)

### Stack
NestJS 10 · TypeScript · Mongoose 8 / MongoDB · Redis (ioredis) · BullMQ · Elasticsearch 8 · Passport JWT · Winston · Swagger · class-validator · class-transformer · Zod

### Module Structure
Every new feature MUST follow this pattern:
```
src/<feature>/
  ├── <feature>.module.ts        # Register controllers, services, imports
  ├── <feature>.controller.ts    # HTTP routing only; use @Body() with DTOs
  ├── <feature>.service.ts       # All business logic lives here
  ├── dto/
  │   ├── create-<feature>.dto.ts
  │   ├── update-<feature>.dto.ts
  │   ├── query-<feature>.dto.ts
  │   └── <feature>-response.dto.ts
  ├── schemas/
  │   └── <feature>.schema.ts    # Mongoose schema + model export
  └── interfaces/
      └── <feature>.interface.ts # TypeScript interfaces
```

### DTO Rules
- Every request body, query param, and response payload MUST have a dedicated DTO.
- Use `class-validator` decorators (`@IsString()`, `@IsOptional()`, `@IsMongoId()`, etc.) for validation.
- Use `class-transformer` (`@Exclude()`, `@Expose()`, `@Transform()`) for serialization.
- DTOs are NEVER Mongoose documents. They are plain classes that map to/from schemas.
- Use `@nestjs/mapped-types` (`PartialType`, `PickType`, `OmitType`) to compose DTOs without duplication.

### MongoDB / Mongoose Rules
- Define schemas using `@Schema()` and `@Prop()` decorators.
- Always define indexes for fields used in queries.
- Use `lean()` for read-only queries where possible.
- Handle `ObjectId` references with `@Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'ModelName' })`.

### Shared Infrastructure (`src/core/`)
- **Guards**: JWT auth guard, roles guard, throttler guard.
- **Decorators**: Custom param decorators, role decorators.
- **Middlewares**: Tenant resolution, request logging.
- **Utils**: Slug generation, pagination helpers, date formatting.
- **Config**: Environment validation and typed config service.
- **Database**: Connection factory, model registry.

### Error Handling
- Use NestJS built-in exception classes (`NotFoundException`, `BadRequestException`, `UnauthorizedException`).
- Never expose raw MongoDB errors to the client.

---

## Frontend Implementation (`frontend/src/`)

### Stack
Next.js 16 (App Router) · React 19 · TypeScript · TailwindCSS 3 · Radix UI · Zustand 4 · TanStack React Query 5 · Zod · react-hook-form 7 · Recharts · Lucide React icons · Sonner (toasts)

### Directory Structure
```
src/
  ├── app/                        # Next.js App Router
  │   ├── (main)/                 # Authenticated layout group
  │   ├── login/                  # Public login page
  │   └── layout.tsx              # Root layout
  ├── components/
  │   ├── ui/                     # Radix-based primitives (Button, Dialog, Select, etc.)
  │   ├── layout/                 # App shell, sidebar, header
  │   ├── forms/                  # Form field wrappers
  │   ├── tables/                 # Data table with TanStack Table
  │   ├── charts/                 # Recharts wrappers
  │   ├── common/                 # Shared components (loaders, error states, empty states)
  │   └── <feature>/              # Feature-specific components
  ├── hooks/                      # Custom React hooks (use-debounce, etc.)
  ├── lib/
  │   ├── api.ts                  # Centralized API client (axios/fetch wrappers)
  │   ├── store.ts                # Zustand store
  │   ├── query.tsx               # React Query provider
  │   ├── types.ts                # Shared TypeScript types/interfaces
  │   ├── constants.ts            # App-wide constants
  │   └── utils.ts                # Helper functions
  └── styles/                     # Global CSS
```

### Component Rules
- **Presentation components**: Receive data via props, render UI. No business logic.
- **Container components / Pages**: Fetch data (React Query), manage state (Zustand), pass to presentation components.
- **UI primitives** (`components/ui/`): Wrap Radix UI with project-specific styling via TailwindCSS and `class-variance-authority`.

### State Management
- **Server State**: React Query (`useQuery`, `useMutation`) for all API data.
- **Client State**: Zustand for UI-only global state (sidebar open, active filters, selected items).
- **Form State**: react-hook-form with `@hookform/resolvers/zod` for Zod schema validation.

### API Integration
- All API calls go through `src/lib/api.ts`.
- Type API responses using shared interfaces from `src/lib/types.ts`.

---

## Instructions
1. **Analyze Specification**: Read the approved `Technical_Specification.md` thoroughly.
2. **Scaffold**: Create the module/component directory structure first.
3. **Implement Backend**: Build schemas → DTOs → services → controllers → module registration.
4. **Implement Frontend**: Build API hooks → components → pages → wire into routing.
5. **Consistency**: Match existing code style, naming conventions, and import patterns found in the codebase.