---
name: audit_code
description: QA Engineer writes test cases, verifies implementation, reports bugs to developer, re-verifies fixes, and signs off
---

# Skill: QA Audit & Verification

## Objective
Your goal as the QA Engineer is to ensure the implementation is production-ready through a systematic process of test case design, execution, bug reporting, and verification loops.

---

## Target Context
- **Backend**: `backend/src/` — NestJS modules, services, controllers, DTOs, schemas.
- **Frontend**: `frontend/src/` — Next.js pages, components, hooks, lib, styles.
- **Specifications**: `Functional_Requirements.md` (user stories) and `Technical_Specification.md` (technical design).

---

## Phase 1: Write Test Cases

Read both the `Functional_Requirements.md` and `Technical_Specification.md`, then create `Test_Cases.md`:

### Test Case Format
```
**TC-[ID]**: [Title]
- **Category**: Functional / API / UI / Security / Edge Case
- **Related User Story**: US-[ID]
- **Preconditions**: [Setup needed]
- **Steps**:
  1. [Step 1]
  2. [Step 2]
- **Expected Result**: [What should happen]
- **Priority**: Critical / High / Medium / Low
- **Status**: ⏳ Pending
```

### Test Coverage Areas

#### 1. Functional Tests
- One test case per acceptance criterion from every user story.
- Happy path + alternative paths for each workflow.

#### 2. API Tests
- Valid input → correct response and status code.
- Invalid input → proper validation error (400).
- Missing/expired auth token → 401/403.
- Non-existent resource → 404.
- Duplicate/conflict → 409.

#### 3. UI Tests
- Page renders without errors.
- Forms validate input correctly (client-side).
- Loading states appear during API calls.
- Error states display user-friendly messages.
- Navigation flows work correctly.
- Responsive layout (if applicable).

#### 4. Security Tests
- Protected endpoints reject unauthenticated requests.
- Role-based access is enforced.
- No hardcoded secrets, tokens, or credentials in source code.
- Input sanitization prevents injection.

#### 5. Edge Case Tests
- Empty states (no data).
- Boundary values (min/max lengths, 0 items, 1000 items).
- Special characters in inputs.
- Concurrent operations.
- Large payloads.

---

## Phase 2: Execute & Verify

Execute each test case by reviewing code and/or using the browser verifier:

### Code Review Checklist
- **Spec Alignment**: Every feature in the Technical Specification is implemented.
- **DTO Integrity**: All endpoints use proper DTOs with `class-validator` decorators. DTOs are separate from schemas.
- **Error Handling**: All service methods use try/catch. NestJS exception classes are used. Frontend shows error states.
- **Type Safety**: Zero `any` types. Strict TypeScript compliance.
- **Dependencies**: All imports resolve. No unused packages.
- **Code Style**: Consistent with existing codebase. No `console.log` in production code.
- **SOLID/DRY**: No duplicated logic. Single responsibility maintained.

### Update Test Status
Mark each test case as:
- ✅ **Pass** — Works as expected.
- ❌ **Fail** — Bug found, document it.
- ⚠️ **Blocked** — Cannot test (missing dependency, environment issue).

---

## Phase 3: Bug Reporting & Fix Loop

For each failed test case, create a bug report:

### Bug Report Format
```
**BUG-[ID]**: [Title]
- **Related Test Case**: TC-[ID]
- **Severity**: Critical / Major / Minor / Cosmetic
- **Steps to Reproduce**:
  1. [Step 1]
  2. [Step 2]
- **Expected Result**: [What should happen]
- **Actual Result**: [What actually happened]
- **Evidence**: [Screenshot, error log, or code snippet]
- **Suggested Fix**: [If obvious]
```

### Fix Loop Process
1. Share the bug report with the **Full-Stack Developer** (@developer).
2. Developer fixes the bugs.
3. **Re-verify** each fixed bug by re-running the related test case.
4. If the fix introduces new issues, add new bug reports.
5. **Repeat until all test cases pass** (zero failures).

---

## Phase 4: Sign-off Report

Once all test cases pass, produce a **QA Sign-off Report** for the user:

```
# QA Sign-off Report

## Summary
- **Total Test Cases**: X
- **Passed**: X ✅
- **Failed**: 0 ❌
- **Blocked**: 0 ⚠️

## Bugs Found & Resolved
| Bug ID | Title | Severity | Fix Applied | Re-verified |
|---|---|---|---|---|
| BUG-001 | ... | Major | Yes | ✅ Pass |

## Coverage
- Functional: X/X user stories verified
- API: X/X endpoints tested
- Security: X/X checks passed
- Edge Cases: X/X scenarios covered

## Confidence Level
[High / Medium / Low] — [Justification]

## Recommendation
✅ Ready for deployment / ❌ Not ready — [Reason]
```

---

## Rules
- NEVER approve code without running through the full checklist.
- ALWAYS write test cases BEFORE verifying — test-first approach.
- ALWAYS provide evidence (code snippets, screenshots) for failures.
- ALWAYS re-verify bug fixes — never trust a fix without confirmation.
- Report the final sign-off to the user with a clear recommendation.