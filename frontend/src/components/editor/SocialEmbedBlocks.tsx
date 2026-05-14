"use client";

import { Youtube, Twitter, Instagram } from "lucide-react";
import React from "react";
import { DefaultReactSuggestionItem } from "@blocknote/react";

// Helper to extract YouTube video ID
const getYouTubeId = (url: string) => {
    const regExp = /^.*(?:youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]{11}).*/;
    const match = url.trim().match(regExp);
    return match && match[1] ? match[1] : null;
};

// Helper to extract Tweet ID
const getTweetId = (url: string) => {
    const match = url.match(/status\/(\d+)/);
    return match ? match[1] : null;
};

// Helper to extract Instagram post ID
const getInstagramId = (url: string) => {
    // Matches URLs like:
    // https://www.instagram.com/p/ABC123/
    // https://www.instagram.com/reel/ABC123/
    // https://instagram.com/p/ABC123/
    const match = url.match(/instagram\.com\/(p|reel|tv)\/([A-Za-z0-9_-]+)/);
    return match ? match[2] : null;
};

// YouTube Slash Command - stores metadata for frontend rendering
export const getYouTubeSlashCommand = (
    editor: any
): DefaultReactSuggestionItem => ({
    title: "YouTube",
    onItemClick: async () => {
        const url = prompt("Enter YouTube URL:");
        if (!url) return;

        const videoId = getYouTubeId(url);

        if (!videoId) {
            alert("Invalid YouTube URL. Please use a valid YouTube link.");
            return;
        }

        const currentBlock = editor.getTextCursorPosition().block;
        const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
        const embedUrl = `https://www.youtube.com/embed/${videoId}`;
        const blockId = crypto.randomUUID();

        // Insert custom YouTube card block with embedded player and ALL props
        editor.insertBlocks(
            [
                {
                    id: blockId,
                    type: "youtubeCard",
                    props: {
                        videoId: videoId,
                        url: url,
                        thumbnailUrl: thumbnailUrl,
                        embedType: "youtube",
                        embedUrl: embedUrl,
                    },
                },
            ],
            currentBlock,
            "after"
        );
    },
    aliases: ["video", "yt", "embed"],
    icon: React.createElement(Youtube, { size: 18 }),
    subtext: "Embed a YouTube video",
});

// Twitter Slash Command - stores metadata for frontend rendering
export const getTwitterSlashCommand = (
    editor: any
): DefaultReactSuggestionItem => ({
    title: "Twitter",
    onItemClick: async () => {
        const url = prompt("Enter Twitter/X post URL:");
        if (!url) return;

        const tweetId = getTweetId(url);

        if (!tweetId) {
            alert("Invalid Twitter URL. Please use a valid Twitter/X post link.");
            return;
        }

        const currentBlock = editor.getTextCursorPosition().block;

        // Show loading state
        editor.insertBlocks(
            [
                {
                    type: "paragraph",
                    content: "⏳ Loading Twitter data...",
                },
            ],
            currentBlock,
            "after"
        );

        try {
            // Fetch oEmbed data from Twitter API
            const oEmbedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}&omit_script=true`;
            const response = await fetch(oEmbedUrl);
            const data = await response.json();

            // Get the inserted loading block
            const blocks = editor.document;
            const loadingBlockIndex = blocks.findIndex((b: any) =>
                b.content &&
                Array.isArray(b.content) &&
                b.content.some((c: any) => c.text?.includes("Loading Twitter data"))
            );

            if (loadingBlockIndex !== -1) {
                const loadingBlock = blocks[loadingBlockIndex];

                // Extract tweet information
                const tweetAuthor = data.author_name || "Twitter User";
                const tweetHandle = data.author_url ? `@${data.author_url.split('/').pop()}` : "";

                // Clean HTML to get tweet text
                let tweetText = "Twitter Post";
                if (data.html) {
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = data.html;
                    const textContent = tempDiv.textContent || tempDiv.innerText || "";
                    // Remove author signature and filter out emojis
                    tweetText = textContent
                        .replace(/— .+ \(@.+\) .+/, '')
                        .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
                        .trim();
                }

                // Remove loading block
                editor.removeBlocks([loadingBlock]);

                // Generate unique block ID
                const blockId = crypto.randomUUID();

                // Insert the custom Twitter card block with ALL props
                editor.insertBlocks(
                    [
                        {
                            id: blockId,
                            type: "twitterCard",
                            props: {
                                url: url,
                                authorName: tweetAuthor,
                                authorHandle: tweetHandle,
                                tweetText: tweetText,
                                tweetId: tweetId,
                                embedType: "twitter",
                                embedUrl: url,
                                oEmbedHtml: data.html || "",
                            },
                        },
                    ],
                    currentBlock,
                    "after"
                );
            }
        } catch (error) {
            console.error("Failed to fetch Twitter data:", error);

            // Fallback with basic metadata
            const blocks = editor.document;
            const loadingBlockIndex = blocks.findIndex((b: any) =>
                b.content &&
                Array.isArray(b.content) &&
                b.content.some((c: any) => c.text?.includes("Loading Twitter data"))
            );

            if (loadingBlockIndex !== -1) {
                const loadingBlock = blocks[loadingBlockIndex];
                editor.removeBlocks([loadingBlock]);

                editor.insertBlocks(
                    [
                        {
                            type: "paragraph",
                            props: {
                                // Minimal metadata on error
                                embedType: "twitter",
                                embedUrl: url,
                                tweetId: tweetId,
                            },
                            content: [
                                {
                                    type: "link",
                                    href: url,
                                    content: `X Post`,
                                },
                                {
                                    type: "text",
                                    text: ` (ID: ${tweetId})`,
                                    styles: { textColor: "gray" },
                                },
                            ],
                        },
                    ],
                    currentBlock,
                    "after"
                );
            }
        }
    },
    aliases: ["tweet", "x", "social"],
    icon: React.createElement(Twitter, { size: 18 }),
    subtext: "Embed a Twitter/X post",
});

// Instagram Slash Command - stores metadata for frontend rendering
export const getInstagramSlashCommand = (
    editor: any
): DefaultReactSuggestionItem => ({
    title: "Instagram",
    onItemClick: async () => {
        const url = prompt("Enter Instagram post URL:");
        if (!url) return;

        const postId = getInstagramId(url);

        if (!postId) {
            alert("Invalid Instagram URL. Please use a valid Instagram post/reel link.");
            return;
        }

        const currentBlock = editor.getTextCursorPosition().block;

        // Show loading state
        editor.insertBlocks(
            [
                {
                    type: "paragraph",
                    content: "⏳ Loading Instagram data...",
                },
            ],
            currentBlock,
            "after"
        );

        try {
            // Fetch oEmbed data from Instagram API
            const oEmbedUrl = `https://graph.facebook.com/v12.0/instagram_oembed?url=${encodeURIComponent(url)}&access_token=YOUR_ACCESS_TOKEN`;

            // Note: Instagram oEmbed requires an access token, so we'll use a fallback approach
            // For now, we'll create a basic embed with the URL

            const blocks = editor.document;
            const loadingBlockIndex = blocks.findIndex((b: any) =>
                b.content &&
                Array.isArray(b.content) &&
                b.content.some((c: any) => c.text?.includes("Loading Instagram data"))
            );

            if (loadingBlockIndex !== -1) {
                const loadingBlock = blocks[loadingBlockIndex];
                const blockId = crypto.randomUUID();

                // Remove loading block
                editor.removeBlocks([loadingBlock]);

                // Insert the custom Instagram card block with ALL props
                editor.insertBlocks(
                    [
                        {
                            id: blockId,
                            type: "instagramCard",
                            props: {
                                url: url,
                                postId: postId,
                                embedType: "instagram",
                                embedUrl: url,
                            },
                        },
                    ],
                    currentBlock,
                    "after"
                );
            }
        } catch (error) {
            console.error("Failed to fetch Instagram data:", error);

            // Fallback with basic metadata
            const blocks = editor.document;
            const loadingBlockIndex = blocks.findIndex((b: any) =>
                b.content &&
                Array.isArray(b.content) &&
                b.content.some((c: any) => c.text?.includes("Loading Instagram data"))
            );

            if (loadingBlockIndex !== -1) {
                const loadingBlock = blocks[loadingBlockIndex];
                const blockId = crypto.randomUUID();

                editor.removeBlocks([loadingBlock]);

                // Use custom Instagram card even on error with ALL props
                editor.insertBlocks(
                    [
                        {
                            id: blockId,
                            type: "instagramCard",
                            props: {
                                url: url,
                                postId: postId,
                                embedType: "instagram",
                                embedUrl: url,
                            },
                        },
                    ],
                    currentBlock,
                    "after"
                );
            }
        }
    },
    aliases: ["ig", "insta", "reel"],
    icon: React.createElement(Instagram, { size: 18 }),
    subtext: "Embed an Instagram post or reel",
});
