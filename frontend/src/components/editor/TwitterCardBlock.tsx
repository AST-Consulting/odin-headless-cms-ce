"use client";

import { createReactBlockSpec } from "@blocknote/react";
import React, { useEffect, useRef, useState } from "react";

// Declare Twitter widget types
declare global {
  interface Window {
    twttr?: {
      widgets: {
        load: (element?: HTMLElement) => void;
        createTweet: (tweetId: string, element: HTMLElement, options?: Record<string, unknown>) => Promise<HTMLElement | undefined>;
      };
      ready: (callback: () => void) => void;
    };
  }
}

// Props interface for the Twitter Card component
interface TwitterCardProps {
  url: string;
  tweetId: string;
  authorName?: string;
  authorHandle?: string;
  tweetText?: string;
}

// Twitter Card Render Component
function TwitterCardRender({ url, tweetId }: TwitterCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const loadedRef = useRef(false);

  useEffect(() => {
    // Prevent double loading in strict mode
    if (loadedRef.current) return;
    if (!tweetId) {
      setError(true);
      setIsLoading(false);
      return;
    }

    let isCancelled = false;
    loadedRef.current = true;

    const loadTwitterWidget = () => {
      if (!containerRef.current || isCancelled) return;

      if (window.twttr?.widgets) {
        window.twttr.widgets
          .createTweet(tweetId, containerRef.current, {
            theme: "light",
            conversation: "none",
            cards: "visible",
            align: "center",
          })
          .then((element) => {
            if (isCancelled) {
              element?.remove();
              return;
            }
            setIsLoading(false);
            if (!element) setError(true);
          })
          .catch((err) => {
            if (!isCancelled) {
              console.error("[TwitterCard] Error loading tweet:", err);
              setError(true);
              setIsLoading(false);
            }
          });
      }
    };

    // Load Twitter widgets script if not already loaded
    if (!window.twttr) {
      const existingScript = document.querySelector('script[src*="platform.twitter.com/widgets.js"]');
      if (existingScript) {
        // Script exists but not loaded yet, wait for it
        const checkReady = setInterval(() => {
          if (window.twttr) {
            clearInterval(checkReady);
            window.twttr.ready(loadTwitterWidget);
          }
        }, 100);
        setTimeout(() => clearInterval(checkReady), 5000); // Timeout after 5s
      } else {
        const script = document.createElement("script");
        script.src = "https://platform.twitter.com/widgets.js";
        script.async = true;
        script.charset = "utf-8";
        script.onload = () => {
          if (window.twttr && !isCancelled) {
            window.twttr.ready(loadTwitterWidget);
          }
        };
        script.onerror = () => {
          if (!isCancelled) {
            console.error("[TwitterCard] Failed to load Twitter widget script");
            setError(true);
            setIsLoading(false);
          }
        };
        document.head.appendChild(script);
      }
    } else {
      window.twttr.ready(loadTwitterWidget);
    }

    return () => {
      isCancelled = true;
    };
  }, [tweetId]);

  if (error) {
    return (
      <div
        contentEditable={false}
        style={{
          margin: "16px 0",
          padding: "16px",
          border: "1px solid #e1e8ed",
          borderRadius: "8px",
          backgroundColor: "#f7f9fa",
        }}
      >
        <p style={{ margin: 0, color: "#657786" }}>
          Unable to load tweet.{" "}
          <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: "#1DA1F2" }}>
            View on X →
          </a>
        </p>
      </div>
    );
  }

  return (
    <div contentEditable={false} style={{ margin: "16px 0", minHeight: isLoading ? "200px" : "auto" }}>
      <div ref={containerRef} style={{ minWidth: "300px", maxWidth: "550px" }} />
      {isLoading && (
        <div
          style={{
            padding: "20px",
            textAlign: "center",
            color: "#657786",
            border: "1px solid #e1e8ed",
            borderRadius: "8px",
          }}
        >
          Loading tweet...
        </div>
      )}
    </div>
  );
}

// Create the Twitter Card block spec
// IMPORTANT: Keep all props that might have been saved historically for backward compatibility
export const TwitterCardBlock = createReactBlockSpec(
  {
    type: "twitterCard",
    propSchema: {
      url: { default: "" },
      tweetId: { default: "" },
      authorName: { default: "" },
      authorHandle: { default: "" },
      tweetText: { default: "" },
      // Keep these for backward compatibility with previously saved blocks
      embedType: { default: "" },
      embedUrl: { default: "" },
      oEmbedHtml: { default: "" },
    },
    content: "none",
  },
  {
    render: (props) => {
      const { url, tweetId, authorName, authorHandle, tweetText } = props.block.props;
      return (
        <TwitterCardRender
          url={url}
          tweetId={tweetId}
          authorName={authorName}
          authorHandle={authorHandle}
          tweetText={tweetText}
        />
      );
    },
  }
);
