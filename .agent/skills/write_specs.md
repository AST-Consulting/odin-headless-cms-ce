---
name: write_functional_requirements
description: Product Manager writes Functional Requirements Document with user stories, acceptance criteria, and success metrics
---

# Skill: Write Functional Requirements

## Objective
Your goal as the Product Manager is to create a clear, comprehensive Functional Requirements Document (FRD) for the user's idea. You focus entirely on WHAT needs to be built and WHY — never on HOW.

---

## Instructions

### 1. Gather Requirements
- Ask clarifying questions if the idea is ambiguous.
- Understand the target users and their pain points.
- Identify which existing areas of Odin CMS (articles, categories, tags, auth, analytics, etc.) are affected.
- Determine the business goals and success metrics.

### 2. Draft the Functional Requirements Document
Create `Functional_Requirements.md` with these sections:

#### 1. Problem Statement
- What problem does this feature solve?
- Who is affected?
- What is the current user experience?

#### 2. Goals & Success Metrics
- Measurable outcomes (e.g., "reduce publish time by 50%", "increase author adoption to 80%").
- Key Performance Indicators (KPIs).

#### 3. User Personas
- Define the user roles involved (admin, editor, viewer, author, etc.).
- Describe each persona's goals and frustrations.

#### 4. User Stories
For each feature, write user stories in the format:
```
**US-[ID]**: As a [role], I want [feature] so that [benefit].

**Acceptance Criteria**:
- [ ] Given [context], when [action], then [expected result].
- [ ] Given [context], when [action], then [expected result].

**Priority**: Must-Have / Should-Have / Nice-to-Have
```

#### 5. User Flows & Wireframes
- Describe the step-by-step user journey for key workflows.
- Include simple wireframe descriptions or flow diagrams where helpful.
- Identify entry points, decision points, and exit points.

#### 6. Edge Cases & Error Scenarios
- What happens when input is invalid?
- What happens when the user has no data?
- What happens when the network is down?
- What happens with concurrent users?

#### 7. Out of Scope
- Explicitly list what is NOT included in this release.
- Prevents scope creep and sets clear expectations.

### 3. Request Approval
- Stop and wait for the user to type **"Approved"** or provide feedback.
- If feedback is given, revise the FRD accordingly and re-submit.
- Loop until the user approves.

---

## Rules
- Do NOT include technical architecture, database schemas, or API designs.
- Do NOT mention specific libraries, frameworks, or implementation details.
- Focus on **user needs**, **business value**, and **acceptance criteria**.
- Write in clear, non-technical language that any stakeholder can understand.