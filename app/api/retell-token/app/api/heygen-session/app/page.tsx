'use client';
import { useRef, useState } from 'react';

export default function Home() {
  const videoRef = useRef<HTMLVideoElement|null>(null);
  const [active, setActive] = useState(false);
  const [ws, setWs] = useState<WebSocket|null>(null);

  async function start() {
    if (active) return;
    setActive(true);

    // 1) Retell web-call token
    const r1 = await fetch('/api/retell-token', { method: 'POST' });
    const retell = await r1.json();
    if (!retell?.access_token) { alert('Failed Retell'); setActive(false); return; }

    // 2) HeyGen session
    const r2 = await fetch('/api/heygen-session', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ avatarId: 'default-avatar-1', voiceId: 'default-voice-1' })
    });
    const hg = await r2.json();
    if (!hg?.session_token && !hg?.player_url) { alert('Failed HeyGen'); setActive(false); return; }

    // 3) Show avatar
    const mount = document.getElementById('mount');
    if (hg?.player_url) {
      const iframe = document.createElement('iframe');
      iframe.src = hg.player_url;
      iframe.style.width = '360px';
      iframe.style.height = '640px';
      iframe.style.border = '0';
      mount?.replaceChildren(iframe);
    } else {
      mount!.innerHTML = '<div style="width:360px;height:640px;display:grid;place-items:center;background:#000;color:#fff;border-radius:16px">Avatar Connected (SDK mode)</div>';
    }

    // 4) Connect mic → Retell
    const socket = new WebSocket(`wss://api.retell.ai/v2/realtime?access_token=${retell.access_token}`);
    setWs(socket);

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const source = audioCtx.createMediaStreamSource(stream);
    const processor = audioCtx.createScriptProcessor(4096, 1, 1);

    processor.onaudioprocess = (e) => {
      const input = e.inputBuffer.getChannelData(0);
      const pcm = new Int16Array(input.length);
      for (let i=0; i<input.length; i++) {
        const s = Math.max(-1, Math.min(1, input[i]));
        pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      if (socket.readyState === 1) socket.send(pcm.buffer);
    };
    source.connect(processor);
    processor.connect(audioCtx.destination);

    // 5) Retell → audio back (play it locally for now)
    socket.onmessage = async (msg) => {
      if (typeof msg.data === 'string') return;
      const buf = await (msg.data as Blob).arrayBuffer();
      const audioBuffer = await audioCtx.decodeAudioData(buf.slice(0));
      const player = audioCtx.createBufferSource();
      player.buffer = audioBuffer;
      player.connect(audioCtx.destination);
      player.start(0);
      // Next step: send these chunks to HeyGen avatar speak() when we confirm SDK method names.
    };

    socket.onclose = () => console.log('Retell closed');
  }

  function stop() {
    setActive(false);
    if (ws) { try { ws.close(); } catch {} setWs(null); }
    const mount = document.getElementById('mount');
    if (mount) mount.innerHTML = '';
  }

  return (
    <main style={{minHeight:'100vh', display:'grid', placeItems:'center', gap:16, fontFamily:'system-ui'}}>
      <div id="mount">
        <video ref={videoRef} autoPlay playsInline muted style={{width:360, height:640, borderRadius:16, background:'#000'}}/>
      </div>
      <div style={{display:'flex', gap:12}}>
        <button onClick={start} disabled={active} style={{padding:'10px 16px'}}>Start</button>
        <button onClick={stop} disabled={!active} style={{padding:'10px 16px'}}>Stop</button>
      </div>
    </main>
  );
}
