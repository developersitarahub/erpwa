import { NextRequest, NextResponse } from "next/server";

const ALLOWED_HOSTS = ["d2xewl4dlr9aio.cloudfront.net", "s3.amazonaws.com"];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");

  if (!url) {
    return new NextResponse("Missing URL parameter", { status: 400 });
  }

  if (!url.startsWith("https://")) {
    return new NextResponse("Only HTTPS URLs allowed", { status: 400 });
  }

  const parsedUrl = new URL(url);

  if (!ALLOWED_HOSTS.includes(parsedUrl.hostname)) {
    return new NextResponse("Forbidden host", { status: 403 });
  }

  try {
    const response = await fetch(url);
    const contentType =
      response.headers.get("content-type") || "application/octet-stream";

    return new NextResponse(response.body, {
      headers: { "Content-Type": contentType },
    });
  } catch (error) {
    console.error("Proxy error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
