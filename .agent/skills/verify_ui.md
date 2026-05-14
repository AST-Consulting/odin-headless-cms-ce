---
name: verify_ui
description: Use the browser subagent to visually verify that implemented UI features render correctly and function as expected
---

# Skill: Verify UI with Browser

## Objective
Your goal as the QA Engineer is to visually verify the implemented features by navigating the running application in a browser. This ensures pages render correctly, data loads, and the UI matches expectations.

---

## Prerequisites
- **Frontend** must be running on `http://localhost:3001`
- **Backend** must be running on `http://localhost:3000` (or `http://localhost:4000`)
- The user must be logged in or the app must be accessible without auth for the pages being tested

## Instructions

### 1. Pre-flight Check
- Confirm the frontend dev server is running by checking terminal output or process status
- Identify the pages/features to verify from the task tracker or implementation plan
- **Obtain Credentials**: Ask the user for the necessary login credentials (email and password) and role to use for testing before starting the browser subagent.

### 2. Browser Verification Steps
Use the `browser_subagent` tool to perform the following for each feature page. Provide the subagent with the credentials so it can log in first.

#### Authentication (First Run)
- Navigate to the login page (e.g., `http://localhost:3001/login` or `http://localhost:3001`)
- Use the credentials obtained from the user (preferably a `super-admin` role) to log in.
- **CRITICAL**: If the login fails (e.g., shows "Invalid credentials"), DO NOT try to click "Sign Up" or attempt alternative flows. Stop the verification process and report the login failure immediately.
- Verify successful login by checking for the dashboard or main layout.



#### Analytics Page (`/analytics`)
- Navigate to `http://localhost:3001/analytics`
- Verify page loads without errors
- Check KPI cards render (Total Views, Total Articles, Avg Views, Impressions)
- Verify the date range selector is present (7d / 30d / 90d)
- Confirm Traffic Chart area renders
- Confirm Top Articles sidebar renders
- Confirm Category Breakdown table renders
- Take a screenshot for documentation

#### SEO Page (`/seo`)
- Navigate to `http://localhost:3001/seo`
- Verify page loads without errors
- Check SEO Score ring renders
- Verify Health Summary and Issue Breakdown cards render
- Confirm "Article Audit" tab shows audit table
- Confirm "Robots.txt" tab shows the robots editor
- Take a screenshot for documentation

#### Settings > SEO Tab (`/settings/seo`)
- Navigate to `http://localhost:3001/settings/seo`
- Verify SEO settings form renders
- Confirm GA Property ID and GSC URL fields are present
- Take a screenshot for documentation

### 3. Error Handling
- If a page shows an error state, capture the error message
- Check the browser console for JavaScript errors
- Report any API failures (check network tab if possible)

### 4. Recording
- Each browser subagent run creates a recording automatically
- Name recordings descriptively: `analytics_page_verify`, `seo_page_verify`, `settings_seo_verify`

### 5. Report
After completing all verification steps:
- **Pass/Fail** status for each page
- Screenshots embedded in the walkthrough artifact
- Any errors or visual issues noted with recommended fixes
- Confirm data loads from real API (not mock data)

---

## Common Issues & Fixes

| Issue | Likely Cause | Fix |
|---|---|---|
| Page shows loading spinner forever | Backend not running or CORS issue | Start backend, check `NEXT_PUBLIC_API_URL` |
| "Error loading data" message | API endpoint returns 500 | Check backend logs for the specific error |
| Empty tables/charts | No data in MongoDB for the current user | Expected for fresh installs — note as "no data" not "broken" |
| 401 Unauthorized | Auth token expired | Re-login in the browser |
| Module not found error | Missing import or build cache | Run `pnpm run dev` fresh, clear `.next` cache |
