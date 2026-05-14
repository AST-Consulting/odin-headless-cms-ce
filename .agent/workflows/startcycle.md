---
description: Start the Autonomous AI Developer Pipeline sequence with a new idea
---

When the user types `/startcycle <idea>`, orchestrate the full development lifecycle strictly using `.agent/agents.md` for role definitions and `.agent/skills/` for execution instructions.

### Execution Sequence:

1. **📋 Product Manager** → Execute `write_specs.md` skill using the `<idea>`.
   - Draft a complete `Functional_Requirements.md` with user stories, acceptance criteria, and success metrics.
   - ⏸️ **HALT**: Wait for the user to explicitly approve the FRD. If the user provides feedback, revise and re-submit. Loop until user types **"Approved"**.

2. **🏗️ Solution Architect** → Execute `write_technical_spec.md` skill.
   - Read the approved `Functional_Requirements.md`.
   - Draft a complete `Technical_Specification.md` with High-Level Design (HLD) and Low-Level Design (LLD).
   - ⏸️ **HALT**: Wait for the user to explicitly approve the Technical Specification. Loop until user types **"Approved"**.

3. **👨‍💻 Full-Stack Developer** → Execute `generate_code.md` skill.
   - Implement the approved Technical Specification following SOLID/KISS/DRY/YAGNI principles.
   - Backend code goes to `backend/src/`.
   - Frontend code goes to `frontend/src/`.

4. **🧪 QA Engineer** → Execute `audit_code.md` skill.
   - **Write Test Cases**: Create `Test_Cases.md` covering functional, API, UI, security, and edge cases.
   - **Verify**: Execute all test cases against the code and running application.
   - **Bug Loop**: If bugs are found:
     - Report bugs to the **Full-Stack Developer** (step 3).
     - Developer fixes the bugs.
     - QA re-verifies the fixes.
     - Repeat until all test cases pass.
   - **Sign-off**: Produce a QA Sign-off Report and share with the user.

5. **🚀 DevOps Master** → Execute `deploy_app.md` skill.
   - Install dependencies with `pnpm install`.
   - Start both backend (`pnpm run start:dev`) and frontend (`pnpm run dev`).
   - Report localhost URLs to the user.

6. **🖥️ UI Verification** → Execute `verify_ui.md` skill.
   - Use the **browser subagent** to navigate to each implemented page.
   - Visually verify that pages render correctly, data loads, and no errors are shown.
   - Capture screenshots and recordings for documentation.
   - Report pass/fail status for each verified page.
   - If issues are found, loop back to the Developer (step 3) to fix and re-verify.