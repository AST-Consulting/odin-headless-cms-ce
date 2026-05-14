# Skill: Deploy App

## Objective
Your goal as DevOps is to bring the Odin CMS application to life locally, ensuring all services and infrastructure are running.

---

## Prerequisites
Before starting the application, verify these services are running:
- **MongoDB** — Required by the NestJS backend (Mongoose).
- **Redis** — Required for caching (ioredis) and job queues (BullMQ).
- **Elasticsearch** — Required for search functionality.

## Instructions

**CRITICAL: You are an autonomous AI. You MUST execute these commands yourself using your `run_command` tool. Do NOT ask the user to run them for you.**

### 1. Environment Check
- Verify `.env` files exist in both `backend/` and `frontend/`.

### 2. Install Dependencies
Use the `run_command` tool with `RunPersistent: true`:
```bash
source ~/.zshrc && cd backend && pnpm install
source ~/.zshrc && cd frontend && pnpm install
```

### 3. Start Backend
Use the `run_command` tool with `RunPersistent: true` and `WaitMsBeforeAsync` so it runs in the background.
```bash
source ~/.zshrc && cd backend && pnpm run start:dev
```
NestJS will start in watch mode. Default port is typically `4000` (or `3000`).

### 4. Start Frontend
Use a separate `run_command` with `RunPersistent: true`.
```bash
source ~/.zshrc && cd frontend && pnpm run dev
```

### 5. Report
- After starting the processes in the background, report both clickable localhost links to the user:
  - Backend API: `http://localhost:4000` (check your `.env`)
  - Frontend UI: `http://localhost:3001`
- Confirm both services started successfully.