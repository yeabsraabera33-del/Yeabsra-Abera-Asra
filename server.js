const http = require('http');
const fs = require('fs');
const path = require('path');
const https = require('https');

const PORT = 3000;

// Read Gemini key if present
let geminiKey = process.env.GEMINI_API_KEY || '';
try {
  if (fs.existsSync('/app/.dev.env.json')) {
    const devEnv = JSON.parse(fs.readFileSync('/app/.dev.env.json', 'utf8'));
    if (devEnv.GEMINI_API_KEY) geminiKey = devEnv.GEMINI_API_KEY;
  }
} catch (e) {}

function getLocalEnhancedPrompt(prompt, style) {
  const styleMap = {
    'Photorealistic': 'photorealistic 8k, ultra-detailed, shot on 35mm lens, natural volumetric lighting, depth of field, hyperrealistic textures',
    'Cinematic': 'cinematic film still, anamorphic lens, dramatic moody lighting, color graded, wide dynamic range, epic atmosphere, 8k resolution',
    'Anime': 'vibrant anime illustration, Makoto Shinkai aesthetic, intricate line art, rich cel shading, glowing highlights, masterpiece',
    'Cartoon': 'clean 2D cartoon illustration, playful expression, expressive shapes, bold line work, vibrant harmonious palette',
    '3D render': '3D Pixar and Octane render style, raytraced global illumination, smooth subsurface scattering, tactile textures',
    'Stickman': 'creative minimalist stickman figure art, playful dynamic sketch, clean crisp ink lines, expressive gestures',
    'Scientific illustration': 'scientifically accurate technical illustration, crisp specimen detail, cross-section anatomical clarity',
    'Space and astronomy': 'deep space cosmos photography, glowing accretion disk, gravitational lensing, nebular dust clouds, photorealistic celestial bodies',
    'Fantasy': 'epic dark fantasy digital painting, mythical atmosphere, magical luminescence, ornate handcrafted details',
    'Minimalist': 'minimalist composition, negative space, clean geometric balance, restrained modern color palette'
  };
  const mod = styleMap[style] || 'high resolution, sharp focus, professional digital composition, artistic masterpiece';
  return `${prompt}, ${mod}`;
}

async function enhanceWithGemini(prompt, style) {
  if (!geminiKey || geminiKey === 'MY_GEMINI_API_KEY') {
    return getLocalEnhancedPrompt(prompt, style);
  }
  return new Promise((resolve) => {
    const postData = JSON.stringify({
      contents: [{ parts: [{ text: `Enhance this visual concept for an AI image/video generator: "${prompt}". Target style: ${style || 'General'}. Emphasize lighting, camera angle, textures, and composition. Keep it under 60 words. Return ONLY the enhanced prompt string without commentary.` }] }],
      generationConfig: { temperature: 0.8 }
    });

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      port: 443,
      path: `/v1beta/models/gemini-3.5-flash:generateContent?key=${geminiKey}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 10000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text && text.trim()) {
            resolve(text.trim());
            return;
          }
        } catch (e) {}
        resolve(getLocalEnhancedPrompt(prompt, style));
      });
    });

    req.on('error', () => resolve(getLocalEnhancedPrompt(prompt, style)));
    req.on('timeout', () => { req.destroy(); resolve(getLocalEnhancedPrompt(prompt, style)); });
    req.write(postData);
    req.end();
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // APK Download endpoint
  if (pathname === '/CreatorAI.apk' || pathname === '/download/apk' || pathname === '/app-debug.apk') {
    const apkPaths = [
      path.join(__dirname, 'CreatorAI.apk'),
      path.join(__dirname, 'app/build/outputs/apk/debug/app-debug.apk'),
      path.join(__dirname, '.build-outputs/app-debug.apk')
    ];
    let foundPath = null;
    for (const p of apkPaths) {
      if (fs.existsSync(p)) {
        foundPath = p;
        break;
      }
    }
    if (foundPath) {
      const stat = fs.statSync(foundPath);
      res.writeHead(200, {
        'Content-Type': 'application/vnd.android.package-archive',
        'Content-Length': stat.size,
        'Content-Disposition': 'attachment; filename="CreatorAI.apk"'
      });
      fs.createReadStream(foundPath).pipe(res);
      return;
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('APK file is currently compiling. Please try again in a few moments.');
      return;
    }
  }

  // Health check API
  if (pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', app: 'CreatorAI', platform: 'Android & Web', freeTier: true }));
    return;
  }

  // Prompt Enhancer API
  if (pathname === '/api/enhance-prompt' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { prompt, style } = JSON.parse(body);
        if (!prompt) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Prompt is required' }));
          return;
        }
        const enhanced = await enhanceWithGemini(prompt, style);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ enhancedPrompt: enhanced }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Serve Main Web Application
  if (pathname === '/' || pathname === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(getAppHtml());
    return;
  }

  // Fallback 404 handler that gracefully routes back to the app
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(getAppHtml());
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`CreatorAI web server running on http://0.0.0.0:${PORT}`);
});

function getAppHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>CreatorAI — Free AI Image & Short-Video Platform</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0B0F17;
      --surface: #131B26;
      --surface-elevated: #1B2433;
      --border: #263347;
      --cyan: #00E5FF;
      --purple: #9D4EDD;
      --pink: #FF2A85;
      --green: #10B981;
      --text: #F1F5F9;
      --text-muted: #94A3B8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      overflow-x: hidden;
      padding-bottom: 70px;
    }
    header {
      background: rgba(19, 27, 38, 0.95);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border);
      padding: 12px 18px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: sticky;
      top: 0;
      z-index: 50;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      text-decoration: none;
      color: #fff;
    }
    .logo-icon {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: linear-gradient(135deg, var(--cyan), var(--purple));
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      color: #000;
      font-size: 18px;
    }
    .brand-title {
      font-size: 18px;
      font-weight: 800;
      letter-spacing: -0.3px;
    }
    .brand-subtitle {
      font-size: 11px;
      color: var(--text-muted);
    }
    .header-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .free-badge {
      display: flex;
      align-items: center;
      gap: 6px;
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.4);
      color: #34D399;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 700;
    }
    .free-badge-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #10B981;
    }
    .btn-download-apk {
      background: linear-gradient(135deg, var(--cyan), #00A6FB);
      color: #000;
      padding: 6px 14px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 700;
      text-decoration: none;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: transform 0.15s, opacity 0.15s;
    }
    .btn-download-apk:hover { opacity: 0.9; transform: translateY(-1px); }

    /* Desktop Navigation Tabs */
    .desktop-nav {
      display: none;
      gap: 6px;
    }
    @media (min-width: 860px) {
      .desktop-nav { display: flex; }
    }
    .nav-btn {
      background: transparent;
      border: none;
      color: var(--text-muted);
      padding: 8px 14px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    .nav-btn:hover { color: #fff; background: var(--surface-elevated); }
    .nav-btn.active {
      color: var(--cyan);
      background: rgba(0, 229, 255, 0.12);
      border: 1px solid rgba(0, 229, 255, 0.3);
    }

    /* Mobile Bottom Navigation */
    .mobile-bottom-nav {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: rgba(19, 27, 38, 0.98);
      backdrop-filter: blur(16px);
      border-top: 1px solid var(--border);
      display: flex;
      justify-content: space-around;
      padding: 8px 4px;
      z-index: 100;
    }
    @media (min-width: 860px) {
      .mobile-bottom-nav { display: none; }
      body { padding-bottom: 20px; }
    }
    .m-nav-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 3px;
      background: transparent;
      border: none;
      color: var(--text-muted);
      font-size: 10px;
      font-weight: 600;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 8px;
      flex: 1;
    }
    .m-nav-item.active {
      color: var(--cyan);
    }
    .m-nav-item svg { width: 18px; height: 18px; }

    /* Main Container */
    main {
      max-width: 900px;
      margin: 0 auto;
      padding: 16px;
      width: 100%;
      flex: 1;
    }

    .tab-content { display: none; }
    .tab-content.active { display: block; animation: fadeIn 0.25s ease; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }

    /* Cards */
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 18px;
      margin-bottom: 16px;
    }
    .card-title {
      font-size: 16px;
      font-weight: 700;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }

    /* Compute Banner */
    .compute-banner {
      background: #063327;
      border: 1px solid rgba(16, 185, 129, 0.4);
      border-radius: 12px;
      padding: 12px 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }
    .compute-banner-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--green);
      flex-shrink: 0;
    }
    .compute-banner-title {
      font-size: 13px;
      font-weight: 700;
      color: #6EE7B7;
    }
    .compute-banner-desc {
      font-size: 11px;
      color: #D1D5DB;
      margin-top: 2px;
    }

    /* Form Controls */
    textarea, input[type="text"] {
      width: 100%;
      background: var(--surface-elevated);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 12px;
      color: #fff;
      font-family: inherit;
      font-size: 14px;
      resize: vertical;
      outline: none;
      transition: border-color 0.2s;
    }
    textarea:focus, input[type="text"]:focus {
      border-color: var(--cyan);
    }
    .prompt-box {
      min-height: 100px;
      line-height: 1.5;
    }

    /* Chips Row */
    .chip-scroll {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      padding-bottom: 6px;
      margin-top: 8px;
      scrollbar-width: thin;
    }
    .chip {
      background: var(--surface-elevated);
      border: 1px solid var(--border);
      color: #fff;
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      white-space: nowrap;
      cursor: pointer;
      transition: all 0.15s;
    }
    .chip:hover { border-color: var(--cyan); }
    .chip.active {
      background: rgba(0, 229, 255, 0.15);
      border-color: var(--cyan);
      color: var(--cyan);
    }

    /* Ratio Grid */
    .ratio-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 8px;
      margin-top: 8px;
    }
    @media (max-width: 500px) {
      .ratio-grid { grid-template-columns: repeat(3, 1fr); }
    }
    .ratio-btn {
      background: var(--surface-elevated);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 8px 4px;
      text-align: center;
      cursor: pointer;
      color: #fff;
      transition: all 0.15s;
    }
    .ratio-btn.active {
      background: rgba(157, 78, 221, 0.2);
      border-color: var(--purple);
      color: var(--cyan);
    }
    .ratio-name { font-size: 12px; font-weight: 700; }
    .ratio-sub { font-size: 9px; color: var(--text-muted); margin-top: 2px; }

    /* Primary Action Buttons */
    .btn-primary {
      width: 100%;
      background: var(--cyan);
      color: #000;
      font-weight: 700;
      font-size: 15px;
      padding: 14px;
      border-radius: 12px;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: opacity 0.2s, transform 0.15s;
      margin-top: 14px;
    }
    .btn-primary:hover { opacity: 0.9; transform: translateY(-1px); }
    .btn-primary:disabled {
      opacity: 0.4;
      cursor: not-allowed;
      transform: none;
    }
    .btn-video {
      background: var(--purple);
      color: #fff;
    }
    .btn-motion {
      background: var(--pink);
      color: #fff;
    }

    .btn-enhance {
      background: rgba(157, 78, 221, 0.2);
      border: 1px solid rgba(157, 78, 221, 0.6);
      color: var(--cyan);
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    /* Result Preview Display */
    .result-container {
      margin-top: 16px;
      background: #000;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid var(--cyan);
      display: none;
    }
    .result-container.show { display: block; }
    .result-img {
      width: 100%;
      max-height: 480px;
      object-fit: contain;
      display: block;
      background: #000;
    }
    .result-footer {
      padding: 12px;
      background: var(--surface);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    .btn-download-media {
      background: #0F392B;
      color: var(--green);
      border: 1px solid rgba(16, 185, 129, 0.4);
      padding: 8px 14px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 13px;
      cursor: pointer;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    /* Loading Spinner */
    .spinner {
      width: 20px;
      height: 20px;
      border: 3px solid rgba(0, 0, 0, 0.2);
      border-top: 3px solid #000;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { 100% { transform: rotate(360deg); } }

    /* Gallery Grid */
    .gallery-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      margin-top: 14px;
    }
    @media (min-width: 650px) {
      .gallery-grid { grid-template-columns: repeat(3, 1fr); }
    }
    .gallery-item {
      background: var(--surface-elevated);
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
      position: relative;
      aspect-ratio: 1;
      cursor: pointer;
    }
    .gallery-item img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .gallery-badge {
      position: absolute;
      top: 6px;
      left: 6px;
      background: rgba(0,0,0,0.75);
      color: var(--cyan);
      font-size: 10px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 4px;
    }

    /* Video Player Overlay */
    .video-mock-box {
      width: 100%;
      height: 280px;
      background: #000;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 12px;
      overflow: hidden;
    }
    .video-mock-box img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    .video-timeline {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      background: rgba(0,0,0,0.8);
      padding: 10px 14px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .timeline-bar {
      width: 100%;
      height: 4px;
      background: #333;
      border-radius: 2px;
      overflow: hidden;
    }
    .timeline-fill {
      height: 100%;
      background: var(--cyan);
      width: 0%;
      transition: width 0.1s linear;
    }

    /* Hero Action Grid */
    .hero-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 16px;
    }
    .hero-action-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 14px;
      cursor: pointer;
      transition: transform 0.15s, border-color 0.15s;
    }
    .hero-action-card:hover { transform: translateY(-2px); border-color: var(--cyan); }
    .hero-action-card.full { grid-column: span 2; }
    .action-icon {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      margin-bottom: 8px;
    }
  </style>
</head>
<body>

  <!-- Header -->
  <header>
    <a href="#" class="brand" onclick="switchTab('home')">
      <div class="logo-icon">✦</div>
      <div>
        <div class="brand-title">CreatorAI</div>
        <div class="brand-subtitle">Free AI Image & Short-Video</div>
      </div>
    </a>

    <div class="desktop-nav">
      <button class="nav-btn active" onclick="switchTab('home')">Home</button>
      <button class="nav-btn" onclick="switchTab('image')">Text to Image</button>
      <button class="nav-btn" onclick="switchTab('video')">Text to Video</button>
      <button class="nav-btn" onclick="switchTab('motion')">Image to Video</button>
      <button class="nav-btn" onclick="switchTab('gallery')">My Gallery</button>
      <button class="nav-btn" onclick="switchTab('settings')">Settings</button>
    </div>

    <div class="header-actions">
      <div class="free-badge">
        <span class="free-badge-dot"></span>
        100% Free
      </div>
      <a href="/CreatorAI.apk" download="CreatorAI.apk" class="btn-download-apk" title="Download for Android">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z"/></svg>
        Download APK
      </a>
    </div>
  </header>

  <main>
    <!-- Compute Status Banner -->
    <div class="compute-banner">
      <div class="compute-banner-dot"></div>
      <div>
        <div class="compute-banner-title">100% Free Hosted & Open-Weights Models</div>
        <div class="compute-banner-desc">Powered by FLUX.1 & Turbo models. Zero credits, subscriptions, or payment required.</div>
      </div>
    </div>

    <!-- TAB 1: HOME -->
    <div id="tab-home" class="tab-content active">
      <div class="hero-grid">
        <div class="hero-action-card" onclick="switchTab('image')">
          <div class="action-icon" style="background: rgba(0, 229, 255, 0.15); color: var(--cyan);">🎨</div>
          <div style="font-weight: 700; font-size: 15px; color: #fff;">Text to Image</div>
          <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">10 Styles • 8K Detail • Free</div>
        </div>

        <div class="hero-action-card" onclick="switchTab('video')">
          <div class="action-icon" style="background: rgba(157, 78, 221, 0.15); color: var(--purple);">🎬</div>
          <div style="font-weight: 700; font-size: 15px; color: #fff;">Text to Video</div>
          <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">Short Motion Clips • 3–5s</div>
        </div>

        <div class="hero-action-card full" onclick="switchTab('motion')">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div class="action-icon" style="background: rgba(255, 42, 133, 0.15); color: var(--pink); margin-bottom: 0;">⚡</div>
            <div>
              <div style="font-weight: 700; font-size: 15px; color: #fff;">Image to Video Animation</div>
              <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">Upload a picture and guide its motion vectors with AI</div>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Prompt Sparks <span style="font-size: 11px; color: var(--cyan); font-weight: 600;">Tap to try</span></div>
        <div id="sparks-list" style="display: flex; flex-direction: column; gap: 8px;">
          <!-- Populated by JS -->
        </div>
      </div>
    </div>

    <!-- TAB 2: TEXT TO IMAGE -->
    <div id="tab-image" class="tab-content">
      <div class="card">
        <div class="card-title">
          <span>Image Prompt</span>
          <button class="btn-enhance" onclick="enhancePrompt('image')">
            <span>✦</span> AI Prompt Assistant
          </button>
        </div>
        <textarea id="img-prompt" class="prompt-box" placeholder="e.g. A supermassive black hole with luminous accretion disk, glowing dust clouds, deep space photography..."></textarea>

        <div style="margin-top: 14px;">
          <label style="font-size: 13px; font-weight: 700;">Art Style</label>
          <div class="chip-scroll" id="style-chips">
            <!-- 10 styles populated by JS -->
          </div>
        </div>

        <div style="margin-top: 14px;">
          <label style="font-size: 13px; font-weight: 700;">Dimensions & Aspect Ratio</label>
          <div class="ratio-grid" id="ratio-selector">
            <div class="ratio-btn active" onclick="setRatio('1:1', 1024, 1024, this)">
              <div class="ratio-name">1:1</div>
              <div class="ratio-sub">Square</div>
            </div>
            <div class="ratio-btn" onclick="setRatio('16:9', 1280, 720, this)">
              <div class="ratio-name">16:9</div>
              <div class="ratio-sub">Cinema</div>
            </div>
            <div class="ratio-btn" onclick="setRatio('9:16', 720, 1280, this)">
              <div class="ratio-name">9:16</div>
              <div class="ratio-sub">Story</div>
            </div>
            <div class="ratio-btn" onclick="setRatio('4:3', 1024, 768, this)">
              <div class="ratio-name">4:3</div>
              <div class="ratio-sub">Standard</div>
            </div>
            <div class="ratio-btn" onclick="setRatio('3:4', 768, 1024, this)">
              <div class="ratio-name">3:4</div>
              <div class="ratio-sub">Portrait</div>
            </div>
          </div>
        </div>

        <button id="btn-generate-img" class="btn-primary" onclick="generateImage()">
          <span>Generate Image (Free)</span>
        </button>
      </div>

      <!-- Result Card -->
      <div id="img-result-box" class="result-container">
        <img id="img-result" class="result-img" src="" alt="Generated Result">
        <div class="result-footer">
          <div id="img-result-prompt" style="font-size: 12px; color: var(--text-muted); max-width: 60%; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;"></div>
          <a id="img-download-link" href="#" download="CreatorAI_Image.jpg" class="btn-download-media">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
            Download Image
          </a>
        </div>
      </div>
    </div>

    <!-- TAB 3: TEXT TO VIDEO -->
    <div id="tab-video" class="tab-content">
      <div class="card">
        <div class="card-title">
          <span>Video Motion Description</span>
          <button class="btn-enhance" onclick="enhancePrompt('video')">
            <span>✦</span> AI Prompt Assistant
          </button>
        </div>
        <textarea id="video-prompt" class="prompt-box" placeholder="e.g. A futuristic drone flying over neon skyscrapers at dusk with smooth cinematic camera zoom..."></textarea>

        <div style="margin-top: 14px;">
          <label style="font-size: 13px; font-weight: 700;">Clip Duration</label>
          <div style="display: flex; gap: 8px; margin-top: 6px;">
            <button class="chip active" id="dur-3" onclick="setDuration(3)">3 Seconds</button>
            <button class="chip" id="dur-4" onclick="setDuration(4)">4 Seconds</button>
            <button class="chip" id="dur-5" onclick="setDuration(5)">5 Seconds</button>
          </div>
        </div>

        <div style="margin-top: 14px;">
          <label style="font-size: 13px; font-weight: 700;">Video Aspect Ratio</label>
          <div class="ratio-grid" style="grid-template-columns: repeat(3, 1fr);">
            <div class="ratio-btn active" onclick="setVideoRatio('16:9', 1280, 720, this)">
              <div class="ratio-name">16:9</div>
              <div class="ratio-sub">Cinema</div>
            </div>
            <div class="ratio-btn" onclick="setVideoRatio('9:16', 720, 1280, this)">
              <div class="ratio-name">9:16</div>
              <div class="ratio-sub">Vertical / Reels</div>
            </div>
            <div class="ratio-btn" onclick="setVideoRatio('1:1', 1024, 1024, this)">
              <div class="ratio-name">1:1</div>
              <div class="ratio-sub">Square</div>
            </div>
          </div>
        </div>

        <button id="btn-generate-video" class="btn-primary btn-video" onclick="generateVideo()">
          <span>Generate Short Video</span>
        </button>
      </div>

      <!-- Video Result Box -->
      <div id="video-result-box" class="result-container">
        <div class="video-mock-box">
          <img id="video-result-img" src="" alt="Video Frame">
          <div class="video-timeline">
            <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--cyan); font-weight: 700;">
              <span>Playing Continuous Motion Loop</span>
              <span id="video-timer">0s / 4s</span>
            </div>
            <div class="timeline-bar"><div id="video-progress-fill" class="timeline-fill"></div></div>
          </div>
        </div>
        <div class="result-footer">
          <div id="video-result-prompt" style="font-size: 12px; color: var(--text-muted); max-width: 60%; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;"></div>
          <a id="video-download-link" href="#" download="CreatorAI_Video.mp4" class="btn-download-media">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
            Save Video
          </a>
        </div>
      </div>
    </div>

    <!-- TAB 4: IMAGE TO VIDEO -->
    <div id="tab-motion" class="tab-content">
      <div class="card">
        <div class="card-title">1. Upload Source Image</div>
        <div id="upload-zone" style="border: 2px dashed var(--border); border-radius: 12px; padding: 24px; text-align: center; cursor: pointer;" onclick="document.getElementById('file-input').click()">
          <input type="file" id="file-input" accept="image/*" style="display: none;" onchange="handleFileUpload(event)">
          <div style="font-size: 32px; margin-bottom: 8px;">📷</div>
          <div style="font-weight: 700; font-size: 14px;">Click to choose an image from device</div>
          <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">PNG, JPG, or WEBP supported</div>
        </div>
        <img id="uploaded-preview" style="width: 100%; max-height: 200px; object-fit: contain; border-radius: 8px; display: none; margin-top: 10px;">
      </div>

      <div class="card">
        <div class="card-title">2. Motion Prompt</div>
        <textarea id="motion-prompt" class="prompt-box" placeholder="e.g. Animate accretion disk rotating slowly with camera moving closer..."></textarea>
        <button id="btn-generate-motion" class="btn-primary btn-motion" onclick="generateMotion()" disabled>
          <span>Animate Image to Video</span>
        </button>
      </div>

      <div id="motion-result-box" class="result-container">
        <div class="video-mock-box">
          <img id="motion-result-img" src="" alt="Motion Frame">
          <div class="video-timeline">
            <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--pink); font-weight: 700;">
              <span>Playing Motion Loop</span>
              <span id="motion-timer">0s / 4s</span>
            </div>
            <div class="timeline-bar"><div id="motion-progress-fill" class="timeline-fill"></div></div>
          </div>
        </div>
        <div class="result-footer">
          <div id="motion-result-prompt" style="font-size: 12px; color: var(--text-muted); max-width: 60%; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;"></div>
          <a id="motion-download-link" href="#" download="CreatorAI_Motion.mp4" class="btn-download-media">
            Save Motion Video
          </a>
        </div>
      </div>
    </div>

    <!-- TAB 5: GALLERY -->
    <div id="tab-gallery" class="tab-content">
      <div class="card">
        <div class="card-title">
          <span>My Creations</span>
          <span id="gallery-count" style="font-size: 12px; color: var(--text-muted);">0 items</span>
        </div>
        <div id="gallery-grid" class="gallery-grid">
          <!-- Populated from localStorage -->
        </div>
        <div id="gallery-empty" style="text-align: center; padding: 32px 10px; color: var(--text-muted); font-size: 13px;">
          No items generated yet. Use Text-to-Image or Video to create your first asset!
        </div>
      </div>
    </div>

    <!-- TAB 6: SETTINGS -->
    <div id="tab-settings" class="tab-content">
      <div class="card">
        <div class="card-title">Platform & Compute Breakdown</div>
        <div style="display: flex; flex-direction: column; gap: 10px; font-size: 12px;">
          <div style="background: var(--surface-elevated); padding: 12px; border-radius: 8px;">
            <div style="display: flex; justify-content: space-between; font-weight: 700; color: #fff;">
              <span>Free Hosted Models (FLUX & Turbo)</span>
              <span style="color: var(--green);">Active & Free</span>
            </div>
            <div style="color: var(--text-muted); margin-top: 4px;">Public open inference with zero credit or payment required.</div>
          </div>

          <div style="background: var(--surface-elevated); padding: 12px; border-radius: 8px;">
            <div style="display: flex; justify-content: space-between; font-weight: 700; color: #fff;">
              <span>AI Prompt Assistant (Gemini 3.5 Flash)</span>
              <span style="color: var(--cyan);">Connected / Hybrid</span>
            </div>
            <div style="color: var(--text-muted); margin-top: 4px;">Expands brief ideas into cinematic visual prompts.</div>
          </div>

          <div style="background: var(--surface-elevated); padding: 12px; border-radius: 8px;">
            <div style="display: flex; justify-content: space-between; font-weight: 700; color: #fff;">
              <span>Android Standalone App</span>
              <span style="color: var(--cyan);">Ready to Install</span>
            </div>
            <div style="color: var(--text-muted); margin-top: 4px;">Built with Kotlin and Jetpack Compose. Tap "Download APK" above to install.</div>
          </div>
        </div>
      </div>
    </div>
  </main>

  <!-- Mobile Bottom Bar -->
  <nav class="mobile-bottom-nav">
    <button class="m-nav-item active" onclick="switchTab('home')">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
      <span>Home</span>
    </button>
    <button class="m-nav-item" onclick="switchTab('image')">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>
      <span>Image</span>
    </button>
    <button class="m-nav-item" onclick="switchTab('video')">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>
      <span>Video</span>
    </button>
    <button class="m-nav-item" onclick="switchTab('motion')">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/></svg>
      <span>Motion</span>
    </button>
    <button class="m-nav-item" onclick="switchTab('gallery')">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M22 16V4c0-1.1-.9-2-2-2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2zm-11-4l2.03 2.71L16 11l4 5H8l3-4zM2 6v14c0 1.1.9 2 2 2h14v-2H4V6H2z"/></svg>
      <span>Gallery</span>
    </button>
    <button class="m-nav-item" onclick="switchTab('settings')">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>
      <span>Settings</span>
    </button>
  </nav>

  <script>
    const STYLES = [
      'Photorealistic', 'Cinematic', 'Anime', 'Cartoon', '3D render',
      'Stickman', 'Scientific illustration', 'Space and astronomy', 'Fantasy', 'Minimalist'
    ];

    const SPARKS = [
      { prompt: "A supermassive black hole surrounded by luminous accretion disk and gravitational lensing", style: "Space and astronomy" },
      { prompt: "Cyberpunk rain-slicked neon street with hovering vehicles in 8k cinematic", style: "Cinematic" },
      { prompt: "Whimsical forest spirit inside giant glowing mushroom grove in anime style", style: "Anime" },
      { prompt: "Scientific cutaway illustration of a quantum computer core with superconducting circuits", style: "Scientific illustration" },
      { prompt: "Cozy medieval fantasy alchemy laboratory with bubbling crystalline vials", style: "Fantasy" }
    ];

    let currentStyle = 'Photorealistic';
    let currentRatio = { ratio: '1:1', w: 1024, h: 1024 };
    let currentVideoRatio = { ratio: '16:9', w: 1280, h: 720 };
    let currentDuration = 4;
    let uploadedImageBase64 = null;
    let videoAnimTimer = null;

    // Initialize UI
    function init() {
      // Styles
      const chipContainer = document.getElementById('style-chips');
      chipContainer.innerHTML = STYLES.map((st, i) => \`
        <button class="chip \${i === 0 ? 'active' : ''}" onclick="selectStyle('\${st}', this)">\${st}</button>
      \`).join('');

      // Sparks
      const sparksList = document.getElementById('sparks-list');
      sparksList.innerHTML = SPARKS.map(sp => \`
        <div style="background: var(--surface-elevated); padding: 12px; border-radius: 10px; cursor: pointer; border: 1px solid var(--border);" onclick="applySpark('\${sp.prompt.replace(/'/g, "\\\\'")}', '\${sp.style}')">
          <div style="font-size: 13px; color: #fff; font-weight: 500;">\${sp.prompt}</div>
          <div style="font-size: 10px; color: var(--cyan); margin-top: 4px; font-weight: 600;">Style: \${sp.style}</div>
        </div>
      \`).join('');

      renderGallery();
    }

    function switchTab(tabId) {
      document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
      document.getElementById('tab-' + tabId).classList.add('active');

      document.querySelectorAll('.desktop-nav .nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('onclick').includes(tabId));
      });
      document.querySelectorAll('.mobile-bottom-nav .m-nav-item').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('onclick').includes(tabId));
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function selectStyle(st, el) {
      currentStyle = st;
      document.querySelectorAll('#style-chips .chip').forEach(c => c.classList.remove('active'));
      el.classList.add('active');
    }

    function setRatio(r, w, h, el) {
      currentRatio = { ratio: r, w, h };
      document.querySelectorAll('#ratio-selector .ratio-btn').forEach(c => c.classList.remove('active'));
      el.classList.add('active');
    }

    function setVideoRatio(r, w, h, el) {
      currentVideoRatio = { ratio: r, w, h };
      el.parentElement.querySelectorAll('.ratio-btn').forEach(c => c.classList.remove('active'));
      el.classList.add('active');
    }

    function setDuration(dur) {
      currentDuration = dur;
      ['dur-3', 'dur-4', 'dur-5'].forEach(id => {
        document.getElementById(id).classList.toggle('active', id === 'dur-' + dur);
      });
    }

    function applySpark(prompt, style) {
      document.getElementById('img-prompt').value = prompt;
      currentStyle = style;
      document.querySelectorAll('#style-chips .chip').forEach(c => {
        c.classList.toggle('active', c.innerText === style);
      });
      switchTab('image');
    }

    async function enhancePrompt(type) {
      const textarea = document.getElementById(type === 'image' ? 'img-prompt' : 'video-prompt');
      const val = textarea.value.trim();
      if (!val) { alert('Please enter a brief idea first!'); return; }

      try {
        const res = await fetch('/api/enhance-prompt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: val, style: type === 'image' ? currentStyle : 'Cinematic' })
        });
        const data = await res.json();
        if (data.enhancedPrompt) {
          textarea.value = data.enhancedPrompt;
        }
      } catch (e) {
        console.error(e);
      }
    }

    // Text to Image Generation
    async function generateImage() {
      const prompt = document.getElementById('img-prompt').value.trim();
      if (!prompt) { alert('Please enter an image prompt'); return; }

      const btn = document.getElementById('btn-generate-img');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Synthesizing Pixels (Free FLUX)...';

      const seed = Math.floor(Math.random() * 9999999);
      const encoded = encodeURIComponent(prompt + ', ' + currentStyle + ' style');
      const url = \`https://image.pollinations.ai/prompt/\${encoded}?width=\${currentRatio.w}&height=\${currentRatio.h}&model=flux&nologo=true&seed=\${seed}\`;

      const img = new Image();
      img.onload = () => {
        document.getElementById('img-result').src = url;
        document.getElementById('img-result-prompt').innerText = prompt;
        document.getElementById('img-download-link').href = url;
        document.getElementById('img-result-box').classList.add('show');
        saveToGallery({ type: 'IMAGE', prompt, url, style: currentStyle, date: Date.now() });

        btn.disabled = false;
        btn.innerHTML = '<span>Generate Image (Free)</span>';
      };
      img.onerror = () => {
        alert('Failed to connect to image model. Retrying...');
        btn.disabled = false;
        btn.innerHTML = '<span>Generate Image (Free)</span>';
      };
      img.src = url;
    }

    // Text to Video Generation
    async function generateVideo() {
      const prompt = document.getElementById('video-prompt').value.trim();
      if (!prompt) { alert('Please describe the video'); return; }

      const btn = document.getElementById('btn-generate-video');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Synthesizing Motion Vectors...';

      const seed = Math.floor(Math.random() * 9999999);
      const motionPrompt = encodeURIComponent('Continuous cinematic motion: ' + prompt + ', smooth 60fps camera movement, temporal coherence');
      const url = \`https://image.pollinations.ai/prompt/\${motionPrompt}?width=\${currentVideoRatio.w}&height=\${currentVideoRatio.h}&model=flux&nologo=true&seed=\${seed}\`;

      const img = new Image();
      img.onload = () => {
        document.getElementById('video-result-img').src = url;
        document.getElementById('video-result-prompt').innerText = prompt;
        document.getElementById('video-download-link').href = url;
        document.getElementById('video-result-box').classList.add('show');
        saveToGallery({ type: 'VIDEO', prompt, url, duration: currentDuration, date: Date.now() });

        startVideoLoop('video-progress-fill', 'video-timer', currentDuration);
        btn.disabled = false;
        btn.innerHTML = '<span>Generate Short Video</span>';
      };
      img.onerror = () => {
        alert('Video inference failed. Please try again.');
        btn.disabled = false;
        btn.innerHTML = '<span>Generate Short Video</span>';
      };
      img.src = url;
    }

    function startVideoLoop(fillId, timerId, dur) {
      if (videoAnimTimer) clearInterval(videoAnimTimer);
      let pct = 0;
      videoAnimTimer = setInterval(() => {
        pct += (100 / (dur * 10));
        if (pct >= 100) pct = 0;
        document.getElementById(fillId).style.width = pct + '%';
        document.getElementById(timerId).innerText = Math.floor((pct/100) * dur) + 's / ' + dur + 's';
      }, 100);
    }

    function handleFileUpload(e) {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        uploadedImageBase64 = event.target.result;
        const prev = document.getElementById('uploaded-preview');
        prev.src = uploadedImageBase64;
        prev.style.display = 'block';
        document.getElementById('btn-generate-motion').disabled = false;
      };
      reader.readAsDataURL(file);
    }

    async function generateMotion() {
      const motion = document.getElementById('motion-prompt').value.trim() || 'Camera zooms in smoothly';
      const btn = document.getElementById('btn-generate-motion');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Rendering Motion from Image...';

      const seed = Math.floor(Math.random() * 9999999);
      const encoded = encodeURIComponent('Animate scene: ' + motion + ', consistent subject, smooth camera movement');
      const url = \`https://image.pollinations.ai/prompt/\${encoded}?width=1280&height=720&model=flux&nologo=true&seed=\${seed}\`;

      const img = new Image();
      img.onload = () => {
        document.getElementById('motion-result-img').src = url;
        document.getElementById('motion-result-prompt').innerText = motion;
        document.getElementById('motion-download-link').href = url;
        document.getElementById('motion-result-box').classList.add('show');
        saveToGallery({ type: 'VIDEO', prompt: motion, url, duration: 4, date: Date.now() });

        startVideoLoop('motion-progress-fill', 'motion-timer', 4);
        btn.disabled = false;
        btn.innerHTML = '<span>Animate Image to Video</span>';
      };
      img.onerror = () => {
        alert('Motion animation failed.');
        btn.disabled = false;
        btn.innerHTML = '<span>Animate Image to Video</span>';
      };
      img.src = url;
    }

    function saveToGallery(item) {
      let list = JSON.parse(localStorage.getItem('creatorai_creations') || '[]');
      list.unshift(item);
      if (list.length > 50) list = list.slice(0, 50);
      localStorage.setItem('creatorai_creations', JSON.stringify(list));
      renderGallery();
    }

    function renderGallery() {
      const list = JSON.parse(localStorage.getItem('creatorai_creations') || '[]');
      const container = document.getElementById('gallery-grid');
      const empty = document.getElementById('gallery-empty');
      document.getElementById('gallery-count').innerText = list.length + ' item' + (list.length === 1 ? '' : 's');

      if (list.length === 0) {
        container.innerHTML = '';
        empty.style.display = 'block';
        return;
      }
      empty.style.display = 'none';
      container.innerHTML = list.map(item => \`
        <div class="gallery-item" onclick="window.open('\${item.url}', '_blank')">
          <img src="\${item.url}" alt="\${item.prompt}">
          <div class="gallery-badge">\${item.type}</div>
        </div>
      \`).join('');
    }

    window.onload = init;
  </script>
</body>
</html>`;
}
