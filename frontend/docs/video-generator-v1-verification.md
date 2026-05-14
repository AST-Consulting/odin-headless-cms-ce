# Video Generator V1 Verification

This checklist tracks release-readiness items from the approved video-generator design.

## E2E Matrix

- [ ] Happy path: mixed media (2 images + 1 clip) -> generate -> upload -> publish -> article insert.
- [ ] No gallery match: fallback provider candidates are returned and selectable.
- [ ] Unsupported clip: candidate shows fallback badge and render completes via still path.
- [ ] Scene media load failure: broken candidate is removed and next candidate is auto-selected.
- [ ] Publish failure retry: failed publish emits telemetry and succeeds on retry flow.
- [ ] Timeout/provider failure: terminal status is surfaced in UI and telemetry.

## Telemetry Validation

- [ ] `gallery-hit-rate` events visible with `propertyId` and `sceneId`.
- [ ] `fallback-rate` events visible with fallback reason.
- [ ] `render-fallback-to-still` events visible for clip selections.
- [ ] `publish-success` and `publish-failure` events visible with `jobId`.
- [ ] 30-minute rolling failure/timeout panel configured for rollback trigger.

## Rollout Guardrails

- [ ] Kill switch (`VIDEO_GENERATOR_CLIP_SELECTION_ENABLED`) validated in staging.
- [ ] Rollback owner confirmed: Backend on-call primary, Frontend on-call secondary.
- [ ] Escalation path confirmed in `#odin-cms-alerts`.
- [ ] Rollback trigger confirmed: >5% publish failure + timeout over rolling 30 minutes, minimum 30 jobs.

