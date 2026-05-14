"use client";

import { createReactBlockSpec } from "@blocknote/react";
import React, { useState } from "react";

// Props interface
interface SoundCloudEmbedProps {
    url: string;
    height?: number;
}

// Helper to validate SoundCloud URL
export function isValidSoundCloudUrl(url: string): boolean {
    // Patterns:
    // https://soundcloud.com/artist/track
    // https://soundcloud.com/artist/sets/playlist
    // https://soundcloud.app.goo.gl/... (shortened URLs)
    return /^https?:\/\/(www\.)?soundcloud\.com\/[\w-]+\/[\w-]+/.test(url) ||
        /^https?:\/\/soundcloud\.app\.goo\.gl/.test(url);
}

// Helper to insert SoundCloud embed
export function insertSoundCloudEmbed(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    editor: any,
    url: string,
    height: number = 166
): boolean {
    if (!isValidSoundCloudUrl(url)) return false;

    const currentBlock = editor.getTextCursorPosition().block;
    editor.insertBlocks(
        [
            {
                type: "soundcloudEmbed",
                props: {
                    url,
                    height: height.toString(),
                },
            },
        ],
        currentBlock,
        "after"
    );

    // Insert a new paragraph below and move focus
    setTimeout(() => {
        const blocks = editor.document;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const currentIndex = blocks.findIndex((b: any) => b.id === currentBlock.id);

        if (currentIndex === -1) return;

        if (currentIndex + 2 < blocks.length) {
            editor.setTextCursorPosition(blocks[currentIndex + 2], "start");
            return;
        }

        if (currentIndex + 1 < blocks.length) {
            const embedBlock = blocks[currentIndex + 1];
            editor.insertBlocks([{ type: "paragraph", content: "" }], embedBlock, "after");

            requestAnimationFrame(() => {
                const updatedBlocks = editor.document;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const embedIndex = updatedBlocks.findIndex((b: any) => b.id === embedBlock.id);
                if (embedIndex !== -1 && embedIndex + 1 < updatedBlocks.length) {
                    editor.setTextCursorPosition(updatedBlocks[embedIndex + 1], "start");
                }
            });
        }
    }, 10);

    return true;
}

// SoundCloud Embed Render Component
function SoundCloudEmbedRender({ url, height = 166 }: SoundCloudEmbedProps) {
    const [error, setError] = useState(false);

    if (!url || error) {
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
                    Unable to load SoundCloud track.{" "}
                    {url && (
                        <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: "#ff5500" }}
                        >
                            Open in SoundCloud →
                        </a>
                    )}
                </p>
            </div>
        );
    }

    // Encode the URL for the SoundCloud widget
    const encodedUrl = encodeURIComponent(url);

    // SoundCloud widget iframe URL
    // Parameters explanation:
    // - url: the track/playlist URL
    // - color: theme color (SoundCloud orange)
    // - auto_play: don't autoplay
    // - hide_related: show related tracks
    // - show_comments: show comments
    // - show_user: show user info
    // - show_reposts: hide reposts
    // - show_teaser: show teaser
    const iframeSrc = `https://w.soundcloud.com/player/?url=${encodedUrl}&color=%23ff5500&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true`;

    return (
        <div
            contentEditable={false}
            style={{
                margin: "16px 0",
                width: "100%",
                maxWidth: "100%"
            }}
        >
            <iframe
                width="100%"
                height={height}
                scrolling="no"
                frameBorder="no"
                allow="autoplay"
                src={iframeSrc}
                style={{
                    border: "none",
                    borderRadius: "8px",
                }}
                title="SoundCloud Player"
                onError={() => setError(true)}
            />
        </div>
    );
}

// Create the SoundCloud Embed block spec
export const SoundCloudEmbedBlock = createReactBlockSpec(
    {
        type: "soundcloudEmbed",
        propSchema: {
            url: { default: "" },
            height: { default: "166" },
        },
        content: "none",
    },
    {
        render: (props) => {
            const { url, height } = props.block.props;
            return <SoundCloudEmbedRender url={url} height={parseInt(height) || 166} />;
        },
    }
);
