import { NextRequest, NextResponse } from "next/server";

/**
 * Image proxy to avoid CORS issues with cross-origin images in canvas-based editors.
 * tui-image-editor (fabric.js) sets crossOrigin: anonymous on image elements.
 * If the source server (S3) has no CORS headers, the browser blocks the request
 * and the canvas becomes tainted — toDataURL() throws SecurityError.
 *
 * This route fetches the image server-side (no CORS restriction) and streams
 * it back under the same origin, so the canvas stays clean.
 */
export async function GET(request: NextRequest) {
    const url = request.nextUrl.searchParams.get("url");

    if (!url) {
        return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
    }

    // Only allow proxying http/https URLs (block file://, data:, etc.)
    let parsedUrl: URL;
    try {
        parsedUrl = new URL(url);
    } catch {
        return NextResponse.json({ error: "Invalid url" }, { status: 400 });
    }

    if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
        return NextResponse.json({ error: "Only http/https URLs are allowed" }, { status: 400 });
    }

    try {
        const response = await fetch(url, {
            headers: {
                // Forward a neutral user agent — some CDNs block requests without one
                "User-Agent": "Mozilla/5.0 (compatible; ImageProxy/1.0)",
            },
        });

        if (!response.ok) {
            return NextResponse.json(
                { error: `Upstream fetch failed: ${response.status}` },
                { status: 502 }
            );
        }

        const contentType = response.headers.get("content-type") ?? "image/jpeg";

        // Only proxy image content types
        if (!contentType.startsWith("image/")) {
            return NextResponse.json({ error: "URL does not point to an image" }, { status: 400 });
        }

        const imageBuffer = await response.arrayBuffer();

        return new NextResponse(imageBuffer, {
            status: 200,
            headers: {
                "Content-Type": contentType,
                "Cache-Control": "public, max-age=86400, immutable",
                // Allow canvas access from same origin
                "Access-Control-Allow-Origin": "*",
            },
        });
    } catch (error) {
        console.error("[image-proxy] fetch error:", error);
        return NextResponse.json({ error: "Failed to fetch image" }, { status: 502 });
    }
}
