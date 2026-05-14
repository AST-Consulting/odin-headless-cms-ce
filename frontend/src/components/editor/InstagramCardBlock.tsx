"use client";

import { createReactBlockSpec } from "@blocknote/react";
import React, { useEffect, useRef } from "react";

// Instagram Card Component using official Instagram embed
const InstagramCardComponent = (props: {
    block: {
        props: {
            url: string;
            postId: string;
        };
    };
}) => {
    const { url } = props.block.props;
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Load Instagram embed script if not already loaded
        if (!(window as any).instgrm) {
            const script = document.createElement("script");
            script.src = "https://www.instagram.com/embed.js";
            script.async = true;
            document.body.appendChild(script);

            script.onload = () => {
                // Process embeds after script loads
                if ((window as any).instgrm?.Embeds) {
                    (window as any).instgrm.Embeds.process();
                }
            };
        } else {
            // Script already loaded, just process embeds
            if ((window as any).instgrm?.Embeds) {
                (window as any).instgrm.Embeds.process();
            }
        }
    }, [url]);

    return (
        <div ref={containerRef} contentEditable={false} style={{ margin: "16px 0" }}>
            <blockquote
                className="instagram-media"
                data-instgrm-permalink={url}
                data-instgrm-version="14"
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
                    Loading Instagram post...
                </a>
            </blockquote>
        </div>
    );
};

// Create the custom block spec using createReactBlockSpec
export const InstagramCardBlock = createReactBlockSpec(
    {
        type: "instagramCard",
        propSchema: {
            url: {
                default: "",
            },
            postId: {
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
        render: (props) => <InstagramCardComponent block={props.block} />,
    }
);
