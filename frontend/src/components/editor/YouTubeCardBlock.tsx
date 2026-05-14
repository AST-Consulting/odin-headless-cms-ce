"use client";

import { createReactBlockSpec } from "@blocknote/react";
import React from "react";

// YouTube Player Component
const YouTubePlayerComponent = (props: {
    block: {
        props: {
            videoId: string;
            url: string;
            thumbnailUrl: string;
        };
    };
}) => {
    const { videoId } = props.block.props;

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
};

// Create the custom block spec using createReactBlockSpec
export const YouTubeCardBlock = createReactBlockSpec(
    {
        type: "youtubeCard",
        propSchema: {
            videoId: {
                default: "",
            },
            url: {
                default: "",
            },
            thumbnailUrl: {
                default: "",
            },
            embedType: {
                default: "",
            },
            embedUrl: {
                default: "",
            },
        },
        content: "none",
    },
    {
        render: (props) => <YouTubePlayerComponent block={props.block} />,
    }
);
