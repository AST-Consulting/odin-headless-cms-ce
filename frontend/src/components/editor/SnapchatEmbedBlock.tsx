"use client";

import { createReactBlockSpec } from "@blocknote/react";
import React from "react";

// Props interface
interface SnapchatEmbedProps {
    url: string;
}

// Extract username from Snapchat URL
function extractSnapchatUsername(url: string): string | null {
    // Pattern: https://www.snapchat.com/@username/spotlight/...
    const match = url.match(/snapchat\.com\/@([^/]+)/);
    return match ? match[1] : null;
}

// Helper to validate Snapchat Spotlight URL
export function isValidSnapchatUrl(url: string): boolean {
    // Patterns:
    // https://www.snapchat.com/spotlight/W7_EDlXWTBiXAEEniNoMPwAAYYm9rZHRocnZlAXxqTYh4AXxqTYh4AXAAA
    // https://www.snapchat.com/@pixel_ly07/spotlight/W7_EDlXWTBiXAEEniNoMPwAAYb3p0ZmZmendoAZtWG_1VAZtWG_0eAAAAAQ
    // https://t.snapchat.com/ABC123
    return /^https?:\/\/(www\.)?snapchat\.com\/((@[\w]+\/)?spotlight\/[a-zA-Z0-9_-]+)/.test(url) ||
        /^https?:\/\/t\.snapchat\.com\/[a-zA-Z0-9]+/.test(url);
}

// Helper to insert Snapchat embed
export function insertSnapchatEmbed(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    editor: any,
    url: string
): boolean {
    if (!isValidSnapchatUrl(url)) return false;

    const currentBlock = editor.getTextCursorPosition().block;
    editor.insertBlocks(
        [
            {
                type: "snapchatEmbed",
                props: {
                    url,
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

// Snapchat ghost logo SVG
const SnapchatGhostIcon = () => (
    <svg
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="white"
    >
        <path d="M12.166 3c1.067 0 3.015.226 4.213 2.08.749 1.16.639 2.924.553 4.327-.015.243-.03.477-.043.7-.006.12.036.178.066.197.044.027.133.035.26-.01a2.55 2.55 0 0 1 .753-.16c.233 0 .454.04.657.123.439.18.724.53.737.908.014.423-.26.826-1.02 1.167-.163.073-.417.147-.686.226-.573.168-.992.293-1.13.558-.077.148-.06.343.051.58.014.03.028.058.04.088.513 1.145 1.18 2.043 1.983 2.67.378.295.8.524 1.254.683.205.07.311.204.324.345.02.2-.126.405-.36.51-.386.173-.834.309-1.37.417a.788.788 0 0 0-.14.045c-.067.032-.148.136-.19.41-.05.316-.173.472-.587.549-.424.08-.847.166-1.533.374-.464.14-1.057.577-1.746 1.086-.885.654-1.888 1.394-3.15 1.394h-.004c-1.263 0-2.267-.74-3.152-1.394-.689-.509-1.282-.947-1.746-1.086-.686-.208-1.11-.295-1.533-.374-.414-.077-.538-.233-.587-.549-.043-.274-.124-.378-.19-.41a.794.794 0 0 0-.141-.045c-.536-.108-.984-.244-1.37-.417-.234-.105-.38-.31-.36-.51.013-.14.119-.274.324-.345a4.49 4.49 0 0 0 1.254-.682c.804-.628 1.47-1.526 1.983-2.67.012-.03.027-.06.04-.089.111-.237.128-.432.051-.58-.138-.265-.557-.39-1.13-.558-.269-.079-.523-.153-.686-.226-.76-.341-1.034-.744-1.02-1.167.013-.378.298-.727.737-.908a1.66 1.66 0 0 1 .657-.122c.27.007.517.056.753.16.127.044.216.036.26.009.03-.019.072-.078.066-.198a24.97 24.97 0 0 1-.043-.7c-.086-1.402-.196-3.166.553-4.326C9.15 3.226 11.098 3 12.166 3z" />
    </svg>
);

// Snapchat Embed Render Component
// Note: Snapchat doesn't provide a public embed API like Twitter/Instagram
// This renders a preview card that links to the Spotlight video
function SnapchatEmbedRender({ url }: SnapchatEmbedProps) {
    const username = extractSnapchatUsername(url);

    // Validate URL to prevent XSS (e.g., javascript: URLs)
    if (!url || !isValidSnapchatUrl(url)) {
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
                    Invalid Snapchat URL
                </p>
            </div>
        );
    }

    return (
        <div
            contentEditable={false}
            style={{
                width: "100%",
                maxWidth: "400px",
                margin: "16px auto",
            }}
        >
            <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                    display: "block",
                    textDecoration: "none",
                    borderRadius: "16px",
                    overflow: "hidden",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                    transition: "transform 0.2s, box-shadow 0.2s",
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow = "0 6px 16px rgba(0,0,0,0.2)";
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
                }}
            >
                {/* Header with Snapchat branding */}
                <div
                    style={{
                        background: "linear-gradient(135deg, #FFFC00 0%, #FFE600 100%)",
                        padding: "20px",
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                    }}
                >
                    <div
                        style={{
                            width: "48px",
                            height: "48px",
                            borderRadius: "50%",
                            backgroundColor: "#000",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <SnapchatGhostIcon />
                    </div>
                    <div>
                        <div
                            style={{
                                fontWeight: "bold",
                                fontSize: "16px",
                                color: "#000",
                            }}
                        >
                            Snapchat Spotlight
                        </div>
                        {username && (
                            <div
                                style={{
                                    fontSize: "14px",
                                    color: "#333",
                                }}
                            >
                                @{username}
                            </div>
                        )}
                    </div>
                </div>

                {/* Content area */}
                <div
                    style={{
                        backgroundColor: "#000",
                        padding: "24px 20px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "16px",
                    }}
                >
                    {/* Play button */}
                    <div
                        style={{
                            width: "64px",
                            height: "64px",
                            borderRadius: "50%",
                            backgroundColor: "#FFFC00",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <svg
                            width="28"
                            height="28"
                            viewBox="0 0 24 24"
                            fill="#000"
                        >
                            <path d="M8 5v14l11-7z" />
                        </svg>
                    </div>

                    <div
                        style={{
                            color: "#fff",
                            fontSize: "14px",
                            textAlign: "center",
                        }}
                    >
                        Tap to watch on Snapchat
                    </div>
                </div>
            </a>
        </div>
    );
}

// Create the Snapchat Embed block spec
export const SnapchatEmbedBlock = createReactBlockSpec(
    {
        type: "snapchatEmbed",
        propSchema: {
            url: { default: "" },
        },
        content: "none",
    },
    {
        render: (props) => {
            const { url } = props.block.props;
            return <SnapchatEmbedRender url={url} />;
        },
    }
);
