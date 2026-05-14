"use client";

import { createReactBlockSpec } from "@blocknote/react";
import React from "react";

// Props interface
interface YouTubeEmbedProps {
  url: string;
  videoId: string;
}

// Helper to extract video ID from URL
export function extractYouTubeVideoId(url: string): string | null {
  // Patterns:
  // https://www.youtube.com/watch?v=VIDEO_ID
  // https://youtu.be/VIDEO_ID
  // https://www.youtube.com/embed/VIDEO_ID
  // https://www.youtube.com/v/VIDEO_ID
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// YouTube Embed Component
export function YouTubeEmbed({ videoId }: YouTubeEmbedProps) {
  if (!videoId) {
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
        }}
      >
        Invalid YouTube URL
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
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "800px",
          position: "relative",
          paddingBottom: "56.25%", // 16:9 aspect ratio
          height: 0,
          overflow: "hidden",
          borderRadius: "8px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        }}
      >
        <iframe
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            border: "none",
            borderRadius: "8px",
          }}
          src={`https://www.youtube.com/embed/${videoId}`}
          title="YouTube video player"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    </div>
  );
}

// Create the YouTube Embed block spec
export const YouTubeEmbedBlock = createReactBlockSpec(
  {
    type: "youtubeEmbed",
    propSchema: {
      url: { default: "" },
      videoId: { default: "" },
    },
    content: "none",
  },
  {
    render: (props: any) => {
      const { url, videoId } = props.block.props;
      return <YouTubeEmbed url={url} videoId={videoId} />;
    },
  }
);
