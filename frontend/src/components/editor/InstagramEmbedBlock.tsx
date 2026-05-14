"use client";

import { createReactBlockSpec } from "@blocknote/react";
import React, { useEffect, useRef, useState } from "react";

// Declare Instagram embed types
declare global {
  interface Window {
    instgrm?: {
      Embeds: {
        process: () => void;
      };
    };
  }
}

// Props interface
interface InstagramEmbedProps {
  url: string;
  postId: string;
}

// Helper to extract post ID from URL
export function extractInstagramPostId(url: string): string | null {
  // Patterns:
  // https://www.instagram.com/p/POST_ID/
  // https://www.instagram.com/reel/POST_ID/
  // https://www.instagram.com/reels/POST_ID/
  // https://instagram.com/p/POST_ID/
  const match = url.match(/instagram\.com\/(?:p|reels?)\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

// Normalize Instagram URL to canonical embed format
// Instagram embed.js requires /reel/ (singular) not /reels/ (plural)
function normalizeInstagramUrl(url: string): string {
  return url.replace(/instagram\.com\/reels\//, "instagram.com/reel/");
}

// Instagram Embed Component
export function InstagramEmbed({ url: rawUrl, postId }: InstagramEmbedProps) {
  const url = normalizeInstagramUrl(rawUrl);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!postId || !url) {
      setError(true);
      setIsLoading(false);
      return;
    }

    let isCancelled = false;

    const processEmbed = () => {
      if (isCancelled) return;

      // Check if already processed
      if (containerRef.current?.querySelector('iframe')) {
        setIsLoading(false);
        return;
      }

      if (window.instgrm?.Embeds) {
        window.instgrm.Embeds.process();
        // Give it a moment to process
        setTimeout(() => {
          if (!isCancelled) {
            setIsLoading(false);
          }
        }, 500);
      }
    };

    // Load Instagram embed script if not already loaded
    if (!window.instgrm) {
      const existingScript = document.querySelector(
        'script[src*="instagram.com/embed.js"]'
      );
      if (existingScript) {
        // Script exists but not loaded yet
        const checkReady = setInterval(() => {
          if (window.instgrm) {
            clearInterval(checkReady);
            processEmbed();
          }
        }, 100);
        setTimeout(() => {
          clearInterval(checkReady);
          if (!isCancelled && !window.instgrm) {
            setError(true);
            setIsLoading(false);
          }
        }, 5000);
      } else {
        const script = document.createElement("script");
        script.src = "https://www.instagram.com/embed.js";
        script.async = true;
        script.onload = () => {
          if (!isCancelled) {
            processEmbed();
          }
        };
        script.onerror = () => {
          if (!isCancelled) {
            console.error("[InstagramEmbed] Failed to load Instagram embed script");
            setError(true);
            setIsLoading(false);
          }
        };
        document.head.appendChild(script);
      }
    } else {
      processEmbed();
    }

    return () => {
      isCancelled = true;
    };
  }, [postId, url]);

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
          Unable to load Instagram post.{" "}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#E1306C" }}
          >
            View on Instagram →
          </a>
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      contentEditable={false}
      style={{ margin: "16px 0", minHeight: isLoading ? "400px" : "auto" }}
    >
      <blockquote
        className="instagram-media"
        data-instgrm-permalink={url}
        data-instgrm-version="14"
        data-instgrm-captioned
        style={{
          background: "#FFF",
          border: "0",
          borderRadius: "3px",
          boxShadow: "0 0 1px 0 rgba(0,0,0,0.5),0 1px 10px 0 rgba(0,0,0,0.15)",
          margin: "1px",
          maxWidth: "540px",
          minWidth: "326px",
          padding: "0",
          width: "calc(100% - 2px)",
        }}
      >
        <a href={url} target="_blank" rel="noopener noreferrer">
          {isLoading ? "Loading Instagram post..." : "View on Instagram"}
        </a>
      </blockquote>
    </div>
  );
}

// Create the Instagram Embed block spec
export const InstagramEmbedBlock = createReactBlockSpec(
  {
    type: "instagramEmbed",
    propSchema: {
      url: { default: "" },
      postId: { default: "" },
    },
    content: "none",
  },
  {
    render: (props: any) => {
      const { url, postId } = props.block.props;
      return <InstagramEmbed url={url} postId={postId} />;
    },
  }
);
