import { NextResponse } from 'next/server';

// Simple image proxy for ibb.co page URLs -> resolves og:image (i.ibb.co direct image)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const pageUrl = searchParams.get('url');
    if (!pageUrl) {
      return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
    }

    // Only allow ibb.co pages
    try {
      const u = new URL(pageUrl);
      if (u.hostname !== 'ibb.co') {
        return NextResponse.json({ error: 'Only ibb.co is allowed' }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: 'Invalid url' }, { status: 400 });
    }

    // Fetch the ibb.co HTML page
    const res = await fetch(pageUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SOP/1.0)' } });
    if (!res.ok) {
      return NextResponse.json({ error: 'Upstream error' }, { status: 502 });
    }
    const html = await res.text();

    // Extract og:image or twitter:image
    const metaMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);

    const imgUrl = metaMatch?.[1];
    if (!imgUrl) {
      return NextResponse.json({ error: 'Image URL not found' }, { status: 502 });
    }

    // Only allow i.ibb.co images
    try {
      const iu = new URL(imgUrl);
      if (!iu.hostname.endsWith('i.ibb.co')) {
        return NextResponse.json({ error: 'Disallowed image host' }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: 'Invalid image URL' }, { status: 400 });
    }

    const imgRes = await fetch(imgUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SOP/1.0)' } });
    if (!imgRes.ok || !imgRes.body) {
      return NextResponse.json({ error: 'Failed to fetch image' }, { status: 502 });
    }

    const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
    const headers = new Headers({ 'Content-Type': contentType, 'Cache-Control': 'public, max-age=3600, s-maxage=86400' });
    return new NextResponse(imgRes.body, { status: 200, headers });
  } catch {
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
  }
}
