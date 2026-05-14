import type { MediaFile } from "@/lib/types";
import type { VideoGenerationJobResult } from "@/lib/api";

export type VideoRenderSessionPhase =
  | "idle"
  | "preparing"
  | "encoding"
  | "uploading"
  | "success"
  | "error";

/** Scene planning survives same-tab navigation (see VideoGeneratorPanel hydrate). */
export type PlanSessionPhase = "idle" | "planning" | "planned" | "plan_error";

export interface VideoRenderSessionInputState {
  title: string;
  content: string;
  aspectRatio: string;
  language: string;
  ttsVoice: string;
  ttsSpeed: number;
  maxScenes: number;
  imageProvider: string;
  category: string;
  includeHook: boolean;
  showSubtitles: boolean;
}

export interface VideoRenderSessionState {
  phase: VideoRenderSessionPhase;
  errorMessage: string | null;
  previewUrl: string | null;
  uploadedVideo: MediaFile | null;
  job: VideoGenerationJobResult | null;
  jobId: string | null;
  planPhase: PlanSessionPhase;
  plannedScript: unknown | null;
  sceneSelections: unknown | null;
  planActiveSceneId: string | null;
  planErrorMessage: string | null;
  /** Saved when planning starts so remount can restore title/content/config. */
  inputSnapshot: VideoRenderSessionInputState | null;
}

const initial: VideoRenderSessionState = {
  phase: "idle",
  errorMessage: null,
  previewUrl: null,
  uploadedVideo: null,
  job: null,
  jobId: null,
  planPhase: "idle",
  plannedScript: null,
  sceneSelections: null,
  planActiveSceneId: null,
  planErrorMessage: null,
  inputSnapshot: null,
};

let state: VideoRenderSessionState = { ...initial };

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function subscribeVideoRenderSession(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getVideoRenderSessionSnapshot(): VideoRenderSessionState {
  return state;
}

/** Revokes any stored preview blob and clears session (e.g. user starts a fresh article). */
export function resetVideoRenderSession() {
  if (state.previewUrl) {
    try {
      URL.revokeObjectURL(state.previewUrl);
    } catch {
      // ignore
    }
  }
  state = { ...initial };
  emit();
}

export function patchVideoRenderSession(patch: Partial<VideoRenderSessionState>) {
  state = { ...state, ...patch };
  emit();
}

/** Call when a new render starts after validation; revokes any prior session preview blob. Preserves plan state. */
export function beginVideoRenderAttempt() {
  const prev = state.previewUrl;
  if (prev) {
    try {
      URL.revokeObjectURL(prev);
    } catch {
      // ignore
    }
  }
  const planKeep = {
    planPhase: state.planPhase,
    plannedScript: state.plannedScript,
    sceneSelections: state.sceneSelections,
    planActiveSceneId: state.planActiveSceneId,
    planErrorMessage: state.planErrorMessage,
  };
  state = {
    ...initial,
    ...planKeep,
    phase: "preparing",
    errorMessage: null,
  };
  emit();
}
