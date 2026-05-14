"use client";

import { createReactBlockSpec } from "@blocknote/react";
import React, { useEffect, useRef } from "react";

// Use local proxy path — Next.js rewrites this server-side so the browser
// never sends an Origin header directly to poll-api-proxy (which causes a 500).
// next.config.mjs: configure poll proxy URL via NEXT_PUBLIC_API_URL
const POLL_SCRIPT_PROXY = "/poll-proxy/assets/polltemplate/pollTemplate.bundle.min.js?v=1.0.1";

// Cache the module promise — only fetch + import once per page
let pollModulePromise: Promise<{ PollWidget: any }> | null = null;

/**
 * Fetch poll.js via same-origin proxy (no Origin header sent to SSO server),
 * create a Blob URL, and import it to get the exported PollWidget class.
 */
function loadPollModule(): Promise<{ PollWidget: any }> {
  if (pollModulePromise) return pollModulePromise;

  pollModulePromise = fetch(POLL_SCRIPT_PROXY)
    .then((res) => {
      if (!res.ok) throw new Error(`poll.js fetch failed: ${res.status}`);
      return res.text();
    })
    .then((code) => {
      const blob = new Blob([code], { type: "application/javascript" });
      const blobUrl = URL.createObjectURL(blob);
      // Use new Function to prevent Turbopack/Webpack from statically analyzing the import
      return new Function("url", "return import(url)")(blobUrl) as Promise<{ PollWidget: any }>;
    })
    .catch((err) => {
      pollModulePromise = null; // Allow retry on next render
      throw err;
    });

  return pollModulePromise;
}

/**
 * Poll Widget Component
 *
 * Key facts from poll.js source code:
 * - Class reads `element.dataset.pollId` which maps to HTML attribute `data-poll-id` (with hyphen)
 * - Internal apiUrl is hardcoded — we override it to go through our proxy
 * - DOMContentLoaded won't fire for React-dynamically-added elements, so we manually instantiate
 */
export function PollComponent({ pollId }: { pollId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pollId || !containerRef.current) return;

    let cancelled = false;
    const el = containerRef.current;

    loadPollModule()
      .then(({ PollWidget: PollWidgetClass }) => {
        if (cancelled || !PollWidgetClass || !el) return;
        try {
          const instance = new PollWidgetClass(el, pollId);
          // Override apiUrl to route all internal API calls through our Next.js proxy.
          // This prevents Origin header from being sent directly to the SSO server.
          instance.apiUrl = window.location.origin + "/poll-proxy";
          instance.init();
        } catch (err) {
          console.error("[PollBlock] Widget init error:", err);
        }
      })
      .catch((err) => {
        if (!cancelled) console.error("[PollBlock] Script load error:", err);
      });

    return () => { cancelled = true; };
  }, [pollId]);

  return (
    <div contentEditable={false} className="my-4 w-full flex flex-col items-start">
      {pollId ? (
        // IMPORTANT: attribute must be data-poll-id (with hyphen).
        // poll.js reads element.dataset.pollId which maps to data-poll-id in HTML.
        <div
          ref={containerRef}
          className="poll-widget"
          data-poll-id={pollId}
          data-template="template#2"
          style={{ maxWidth: "450px", width: "100%", marginLeft: "0", marginRight: "auto" }}
        />
      ) : (
        <div className="p-6 border-2 border-dashed rounded-xl text-center text-muted-foreground bg-gray-50/50 dark:bg-gray-800/20">
          <p className="text-sm font-medium">No poll selected</p>
        </div>
      )}
    </div>
  );
}

export const PollBlock = createReactBlockSpec(
  {
    type: "pollEmbed",
    propSchema: {
      pollId: { default: "" },
    },
    content: "none",
  },
  {
    render: (props: any) => {
      const { pollId } = props.block.props;
      return <PollComponent pollId={pollId} />;
    },
  }
);
