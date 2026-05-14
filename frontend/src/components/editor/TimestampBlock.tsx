"use client";

import { createReactBlockSpec, DefaultReactSuggestionItem } from "@blocknote/react";
import { Clock, Pencil, User } from "lucide-react";
import React from "react";

// Event emitter for timestamp edit requests
type TimestampEditListener = (blockId: string, currentTimestamp: string) => void;
let editListener: TimestampEditListener | null = null;

export const setTimestampEditListener = (listener: TimestampEditListener | null) => {
    editListener = listener;
};

// Event emitter for author name edit requests
type AuthorNameEditListener = (blockId: string, currentAuthorName: string) => void;
let authorNameEditListener: AuthorNameEditListener | null = null;

export const setAuthorNameEditListener = (listener: AuthorNameEditListener | null) => {
    authorNameEditListener = listener;
};

/**
 * Gets the user's timezone abbreviation (e.g., "IST", "EST", "PST")
 * Uses the browser's timezone, preferring named abbreviations over offset format
 */
const getTimezoneAbbreviation = (date: Date): string => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    // Map of common offset strings to named abbreviations
    const offsetToName: Record<string, string> = {
        "GMT+5:30": "IST",
        "GMT+5:45": "NPT",
        "GMT+6:30": "MMT",
        "GMT+3:30": "IRST",
        "GMT+4:30": "AFT",
        "GMT+9:30": "ACST",
    };

    try {
        const formatter = new Intl.DateTimeFormat("en", {
            timeZone,
            timeZoneName: "short",
        });
        const parts = formatter.formatToParts(date);
        const tzPart = parts.find((part) => part.type === "timeZoneName");
        const value = tzPart?.value || "";

        // If browser returned an offset like "GMT+5:30", map it to a name
        if (value.startsWith("GMT") && offsetToName[value]) {
            return offsetToName[value];
        }

        return value || timeZone.split("/").pop() || "UTC";
    } catch {
        return "UTC";
    }
};

/**
 * Formats a timestamp for live blog updates
 * Format: dd/mm/yyyy, hh:mm AM/PM TZ (e.g., "08/03/2026, 10:49 AM IST")
 */
export const formatTimestamp = (date: Date): string => {
    const hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 || 12;

    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();

    const timezone = getTimezoneAbbreviation(date);

    return `${day}/${month}/${year}, ${displayHours}:${minutes} ${ampm} ${timezone}`;
};

// Props interface
interface TimestampRenderProps {
    blockId: string;
    timestamp: string;
    authorName?: string;
    authorId?: string;
    authorSlug?: string;
    isAlert?: string;
    status?: string;
}

// Timestamp Render Component
function TimestampRender({ blockId, timestamp, authorName, authorId, authorSlug, isAlert, status }: TimestampRenderProps) {
    const date = timestamp ? new Date(timestamp) : new Date();
    const formattedTime = formatTimestamp(date);
    const alert = isAlert === "true";

    const handleEdit = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (editListener) {
            editListener(blockId, timestamp);
        }
    };

    const handleAuthorEdit = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (authorNameEditListener) {
            authorNameEditListener(blockId, authorName || "");
        }
    };

    return (
        <div
            contentEditable={false}
            className={`flex flex-col gap-1 py-1.5 px-2 rounded-md -mx-1 ${
                alert
                    ? "bg-red-50 border-l-4 border-l-red-500 dark:bg-red-950/30 dark:border-l-red-400"
                    : ""
            }`}
        >
            <div className="inline-flex items-center gap-2">
                {alert && (
                    <span className="text-[10px] font-bold tracking-wider text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/50 px-1.5 py-0.5 rounded">
                        BREAKING
                    </span>
                )}
                <span className={`font-bold ${alert ? "text-red-600 dark:text-red-400" : "text-blue-600 dark:text-blue-400"}`}>
                    {formattedTime}
                </span>
                <button
                    onClick={handleEdit}
                    className="inline-flex items-center justify-center w-6 h-6 p-1 border border-gray-200 dark:border-gray-700 rounded bg-gray-50 dark:bg-gray-800 cursor-pointer opacity-70 hover:opacity-100 transition-opacity"
                    title="Edit timestamp"
                    aria-label="Edit timestamp"
                >
                    <Pencil size={14} className="text-gray-500 dark:text-gray-400" />
                </button>
            </div>
            <div className="inline-flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
                <User size={14} />
                <span>By {authorName || "Unknown"}</span>
                <button
                    onClick={handleAuthorEdit}
                    className="inline-flex items-center justify-center w-5 h-5 p-0.5 border border-gray-200 dark:border-gray-700 rounded bg-gray-50 dark:bg-gray-800 cursor-pointer opacity-70 hover:opacity-100 transition-opacity"
                    title="Edit author name"
                    aria-label="Edit author name"
                >
                    <Pencil size={12} className="text-gray-500 dark:text-gray-400" />
                </button>
            </div>
        </div>
    );
}

// Create the Timestamp block spec
export const TimestampBlock = createReactBlockSpec(
    {
        type: "timestamp",
        propSchema: {
            timestamp: { default: "" },
            authorName: { default: "" },
            authorId: { default: "" },
            authorSlug: { default: "" },
            isAlert: { default: "false" },
            status: { default: "active" },
        },
        content: "none",
    },
    {
        render: (props) => {
            const { timestamp, authorName, authorId, authorSlug, isAlert, status } = props.block.props;
            return <TimestampRender blockId={props.block.id} timestamp={timestamp} authorName={authorName} authorId={authorId} authorSlug={authorSlug} isAlert={isAlert} status={status} />;
        },
    }
);

/**
 * Gets the slash command configuration for inserting a timestamp
 * @param editor - The BlockNote editor instance
 * @param currentUser - The current logged-in user (optional)
 * @returns Slash command item configuration
 */
export const getTimestampSlashCommand = (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    editor: any,
    currentUser?: { id: string; name: string; slug: string } | null
): DefaultReactSuggestionItem => ({
    title: "Timestamp",
    onItemClick: () => {
        const currentBlock = editor.getTextCursorPosition().block;
        const now = new Date().toISOString();

        editor.insertBlocks(
            [
                {
                    type: "timestamp",
                    props: {
                        timestamp: now,
                        authorName: currentUser?.name || "",
                        authorId: currentUser?.id || "",
                        authorSlug: currentUser?.slug || "",
                    },
                },
            ],
            currentBlock,
            "after"
        );

        // Insert a new paragraph below for content entry and move focus
        setTimeout(() => {
            const blocks = editor.document;
            const currentIndex = blocks.findIndex(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (b: any) => b.id === currentBlock.id
            );

            if (currentIndex === -1) return;

            // Check if there's already a block after the timestamp
            if (currentIndex + 2 < blocks.length) {
                editor.setTextCursorPosition(blocks[currentIndex + 2], "start");
                return;
            }

            // Add a new paragraph after timestamp if needed
            if (currentIndex + 1 < blocks.length) {
                const timestampBlock = blocks[currentIndex + 1];
                editor.insertBlocks(
                    [{ type: "paragraph", content: "" }],
                    timestampBlock,
                    "after"
                );
                // Move focus to the new paragraph - use requestAnimationFrame for more reliable timing
                requestAnimationFrame(() => {
                    const updatedBlocks = editor.document;
                    const tsIndex = updatedBlocks.findIndex(
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (b: any) => b.id === timestampBlock.id
                    );
                    if (tsIndex !== -1 && tsIndex + 1 < updatedBlocks.length) {
                        editor.setTextCursorPosition(updatedBlocks[tsIndex + 1], "start");
                    }
                });
            }
        }, 10);
    },
    aliases: ["time", "timestamp", "clock", "live", "update"],
    icon: React.createElement(Clock, { size: 18 }),
    subtext: "Insert current timestamp for live blog updates",
});
