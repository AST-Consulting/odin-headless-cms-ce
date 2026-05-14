"use client";

import { createReactBlockSpec } from "@blocknote/react";
import React, { useEffect, useRef, useState } from "react";

// Declare Twitter widget types
declare global {
  interface Window {
    twttr?: {
      widgets: {
        load: (element?: HTMLElement) => void;
        createTweet: (
          tweetId: string,
          element: HTMLElement,
          options?: Record<string, unknown>
        ) => Promise<HTMLElement | undefined>;
      };
      ready: (callback: () => void) => void;
    };
  }
}

// Props interface
export interface TwitterEmbedProps {
  url: string;
  tweetId: string;
}

// Helper to extract tweet ID from URL
export function extractTweetId(url: string): string | null {
  // Patterns:
  // https://twitter.com/username/status/1234567890
  // https://x.com/username/status/1234567890
  const match = url.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/);
  return match ? match[1] : null;
}

// Twitter Embed Component
export function TwitterEmbed({ url, tweetId }: TwitterEmbedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!tweetId) {
      setError(true);
      setIsLoading(false);
      return;
    }

    let isCancelled = false;

    const loadTweet = () => {
      if (!containerRef.current || isCancelled) return;

      // Check if tweet is already rendered (prevents double loading)
      if (containerRef.current.querySelector('.twitter-tweet-rendered, iframe[id^="twitter-widget"]')) {
        setIsLoading(false);
        return;
      }

      // Clear any partial content
      containerRef.current.innerHTML = "";

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
              console.error("[TwitterEmbed] Error loading tweet:", err);
              setError(true);
              setIsLoading(false);
            }
          });
      }
    };

    // Load Twitter widgets script if not already loaded
    if (!window.twttr) {
      const existingScript = document.querySelector(
        'script[src*="platform.twitter.com/widgets.js"]'
      );
      if (existingScript) {
        // Script exists but not loaded yet
        const checkReady = setInterval(() => {
          if (window.twttr) {
            clearInterval(checkReady);
            window.twttr.ready(loadTweet);
          }
        }, 100);
        setTimeout(() => clearInterval(checkReady), 5000);
      } else {
        const script = document.createElement("script");
        script.src = "https://platform.twitter.com/widgets.js";
        script.async = true;
        script.charset = "utf-8";
        script.onload = () => {
          if (window.twttr && !isCancelled) {
            window.twttr.ready(loadTweet);
          }
        };
        script.onerror = () => {
          if (!isCancelled) {
            console.error("[TwitterEmbed] Failed to load Twitter widget script");
            setError(true);
            setIsLoading(false);
          }
        };
        document.head.appendChild(script);
      }
    } else {
      window.twttr.ready(loadTweet);
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
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#1DA1F2" }}
          >
            View on X →
          </a>
        </p>
      </div>
    );
  }

  return (
    <div
      contentEditable={false}
      style={{ margin: "16px 0", minHeight: isLoading ? "200px" : "auto" }}
    >
      <div
        ref={containerRef}
        style={{ minWidth: "300px", maxWidth: "550px" }}
      />
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

// Create the Twitter Embed block spec
export const TwitterEmbedBlock = createReactBlockSpec(
  {
    type: "twitterEmbed",
    propSchema: {
      url: { default: "" },
      tweetId: { default: "" },
    },
    content: "none",
  },
  {
    render: (props: any) => {
      const { url, tweetId } = props.block.props;
      return <TwitterEmbed url={url} tweetId={tweetId} />;
    },
  }
);
