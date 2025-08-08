// app/api/heygen-session/route.ts
export const runtime = 'edge';

export async function POST(req: Request) {
  const { avatarId, voiceId } = await req.json();

  const resp = await fetch('https://api.heygen.com/v1/video.generate', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.HEYGEN_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      avatar_id: avatarId,
      voice_id: voiceId,
      // other HeyGen params...
    })
  });

  if (!resp.ok) {
    const txt = await resp.text();
    return new Response(JSON.stringify({ error: 'heygen-fail', details: txt }), { status: 500 });
  }

  const data = await resp.json();
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function GET() {
  return new Response(JSON.stringify({ ok: true, route: 'heygen-session' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
