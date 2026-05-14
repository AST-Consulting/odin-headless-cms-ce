"use client";

import { createReactBlockSpec } from "@blocknote/react";
import React, { useRef, useState, useCallback } from "react";

interface VideoEmbedProps {
  url: string;
  caption: string;
}

function VideoEmbedRender({ url, caption }: VideoEmbedProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasError, setHasError] = useState(false);

  const handleError = useCallback(() => {
    setHasError(true);
  }, []);

  if (!url) {
    return (
      <div
        contentEditable={false}
        style={{
          margin: "16px 0",
          padding: "16px",
          border: "1px solid #e1e8ed",
          borderRadius: "8px",
          backgroundColor: "#f7f9fa",
          color: "#657786",
          textAlign: "center",
        }}
      >
        No video URL provided
      </div>
    );
  }

  if (hasError) {
    return (
      <div
        contentEditable={false}
        style={{
          margin: "16px 0",
          padding: "16px",
          border: "1px solid #e1e8ed",
          borderRadius: "8px",
          backgroundColor: "#f7f9fa",
          color: "#657786",
          textAlign: "center",
        }}
      >
        <p style={{ margin: 0 }}>Failed to load video</p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#1d9bf0", fontSize: "14px" }}
        >
          Open video link
        </a>
      </div>
    );
  }

  return (
    <div
      contentEditable={false}
      style={{
        margin: "16px 0",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "800px",
          borderRadius: "8px",
          overflow: "hidden",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          backgroundColor: "#000",
        }}
      >
        <video
          ref={videoRef}
          src={url}
          controls
          preload="metadata"
          onError={handleError}
          style={{
            width: "100%",
            display: "block",
            maxHeight: "500px",
          }}
        />
      </div>
      {caption && (
        <p
          style={{
            marginTop: "8px",
            fontSize: "14px",
            color: "#657786",
            textAlign: "center",
          }}
        >
          {caption}
        </p>
      )}
    </div>
  );
}

export function isValidVideoUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return false;
    }
    // Check for common video file extensions or known video CDN patterns
    const videoExtensions = /\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i;
    if (videoExtensions.test(parsed.pathname)) {
      return true;
    }
    // Also allow URLs that look like they come from CDN/upload paths
    if (parsed.pathname.includes("/uploads/") || parsed.pathname.includes("/media/") || parsed.pathname.includes("/videos/")) {
      return true;
    }
    // Allow any https URL - the video element will handle validation
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

export const VideoEmbedBlock = createReactBlockSpec(
  {
    type: "videoEmbed",
    propSchema: {
      url: { default: "" },
      caption: { default: "" },
    },
    content: "none",
  },
  {
    render: (props) => {
      const { url, caption } = props.block.props;
      return <VideoEmbedRender url={url} caption={caption} />;
    },
  }
);
