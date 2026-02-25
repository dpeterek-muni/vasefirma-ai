/**
 * VaseFirma AI Assistant Widget
 * Shadow DOM embeddable chat widget
 */
(function() {
  'use strict';

  const scriptTag = document.currentScript || document.getElementsByTagName('script')[document.getElementsByTagName('script').length - 1];

  const attrs = {
    company: scriptTag.dataset.company || 'vasefirma',
    position: scriptTag.dataset.position || null,
    color: scriptTag.dataset.color || null,
    apiBase: scriptTag.dataset.api || scriptTag.src.replace('/widget.js', ''),
    isPreview: scriptTag.dataset.preview === 'true',
    feedbackMode: scriptTag.dataset.feedbackMode || null
  };

  const config = {
    company: attrs.company,
    apiBase: attrs.apiBase,
    companyName: 'Vaše Firma',
    primaryColor: attrs.color || '#564fd8',
    logo: null,
    logoBackground: '#ffffff',
    logoPosition: 50,
    logoZoom: 65,
    coverPhoto: null,
    coverPhotoPosition: 50,
    coverPhotoZoom: 300,
    position: attrs.position || 'bottom-right',
    welcomeHeadline: 'Jak vám mohu pomoci?',
    welcomeMessage: 'Zeptejte se mě na cokoliv ohledně zaměstnanecké aplikace, benefitů, směrnic nebo firemních procesů.',
    disclaimer: null,
    quickReplies: [
      'Jaké moduly aplikace nabízí?',
      'Jak fungují benefity?',
      'Jak nahlásit podnět?',
      'Jak funguje whistleblowing?'
    ],
    autoPopupDelay: 8000,
    enablePulse: true,
    isPreview: attrs.isPreview,
    feedbackMode: attrs.feedbackMode
  };

  const sessionId = 'w_' + Math.random().toString(36).substr(2, 9);
  let isOpen = false;
  let isLoading = false;
  let headerMinimized = false;
  let chatHistory = [];
  let host = null;
  let shadow = null;

  const hexToRgb = (hex) => {
    const h = (hex || '#564fd8').replace('#', '');
    return [parseInt(h.substr(0,2),16), parseInt(h.substr(2,2),16), parseInt(h.substr(4,2),16)].join(',');
  };

  function renderMarkdown(text) {
    const lines = text.split('\n');
    const out = [];
    let lastType = 'none';
    let hadBlank = false;

    function inlineFmt(s) {
      return escapeHtml(s)
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
    }

    function addBlock(html) {
      out.push(html);
      lastType = 'block'; hadBlank = false;
    }

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      if (raw.trim() === '') { hadBlank = true; continue; }

      if (/^---+$/.test(raw.trim())) { addBlock('<div style="border-top:1px solid #e5e7eb;margin:8px 0;"></div>'); continue; }

      const h4 = raw.match(/^#{4,}\s+(.+)$/);
      if (h4) { addBlock(`<strong style="display:block;font-size:13px;margin:6px 0 2px;">${inlineFmt(h4[1])}</strong>`); continue; }
      const h3 = raw.match(/^###\s+(.+)$/);
      if (h3) { addBlock(`<strong style="display:block;font-size:14px;margin:6px 0 2px;">${inlineFmt(h3[1])}</strong>`); continue; }
      const h2 = raw.match(/^##\s+(.+)$/);
      if (h2) { addBlock(`<strong style="display:block;font-size:15px;margin:6px 0 2px;">${inlineFmt(h2[1])}</strong>`); continue; }
      const h1 = raw.match(/^#\s+(.+)$/);
      if (h1) { addBlock(`<strong style="display:block;font-size:16px;margin:8px 0 2px;">${inlineFmt(h1[1])}</strong>`); continue; }

      const num = raw.match(/^(\d+)\.\s+(.+)$/);
      if (num) { addBlock(`<div style="display:flex;gap:5px;margin:1px 0;"><span style="color:${config.primaryColor};font-weight:600;min-width:18px;">${num[1]}.</span><span>${inlineFmt(num[2])}</span></div>`); continue; }

      const bullet = raw.match(/^[-•]\s+(.+)$/);
      if (bullet) { addBlock(`<div style="display:flex;gap:5px;margin:1px 0;padding-left:4px;"><span style="color:${config.primaryColor};">&#8226;</span><span>${inlineFmt(bullet[1])}</span></div>`); continue; }

      if (out.length > 0) {
        if (hadBlank) { out.push('<div style="height:4px;"></div>'); }
        else if (lastType === 'text') { out.push('<br>'); }
      }
      out.push(inlineFmt(raw));
      lastType = 'text'; hadBlank = false;
    }
    return out.join('');
  }

  function escapeHtml(t) {
    const d = document.createElement('div');
    d.textContent = t;
    return d.innerHTML;
  }

  function buildCSS() {
    const c = config.primaryColor;
    const rgb = hexToRgb(c);
    const pos = config.position === 'bottom-left' ? 'left' : 'right';

    return `
      :host {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        font-size: 16px !important;
        line-height: 1.5 !important;
        color: #1f2937 !important;
      }
      *, *::before, *::after {
        box-sizing: border-box !important;
        margin: 0; padding: 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      }

      .caw-widget {
        position: fixed;
        ${pos}: 20px;
        bottom: 20px;
        z-index: 999999;
      }

      .caw-btn {
        width: 60px; height: 60px; border-radius: 50%;
        background: ${config.logo ? config.logoBackground : c};
        border: 2px solid rgba(255,255,255,0.3);
        cursor: pointer; display: flex; align-items: center; justify-content: center;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15), 0 2px 6px rgba(0,0,0,0.1);
        transition: transform 0.2s, box-shadow 0.2s, opacity 0.2s;
        overflow: hidden; position: relative;
      }
      .caw-btn:hover {
        transform: scale(1.05);
        box-shadow: 0 6px 20px rgba(0,0,0,0.2), 0 4px 10px rgba(0,0,0,0.15);
      }
      .caw-btn.hidden { opacity: 0; pointer-events: none; transform: scale(0.8); }
      .caw-btn svg { width: 26px; height: 26px; fill: white; }
      .caw-btn img { width: ${config.logoZoom}%; height: ${config.logoZoom}%; object-fit: cover; }
      .caw-btn.pulse { animation: breathe 3s ease-in-out infinite; }
      @keyframes breathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }

      .online-dot {
        position: absolute; top: 4px; ${pos}: 4px;
        width: 14px; height: 14px; background: #10b981;
        border: 3px solid white; border-radius: 50%;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        animation: pulseDot 2s ease-in-out infinite;
        z-index: 1;
      }
      @keyframes pulseDot {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.8; transform: scale(1.1); }
      }

      .caw-box {
        position: absolute; ${pos}: 0; bottom: 0;
        width: 520px; max-width: calc(100vw - 40px);
        height: 700px; max-height: calc(100vh - 40px);
        background: white; border-radius: 16px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.18), 0 4px 12px rgba(0,0,0,0.12);
        display: none; flex-direction: column; overflow: hidden;
      }
      .caw-box.open { display: flex; animation: slideUp 0.3s ease-out; }
      @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

      .caw-header {
        display: flex; flex-direction: column;
        background: white; transition: all 0.3s ease;
        position: relative; flex-shrink: 0;
      }

      .caw-header-controls {
        position: absolute; top: 12px; right: 12px;
        display: flex; gap: 8px; z-index: 2;
      }
      .caw-header-controls button {
        background: rgba(255,255,255,0.9); border: none; color: #333;
        cursor: pointer; padding: 8px; display: flex; align-items: center;
        border-radius: 50%; transition: all 0.2s; backdrop-filter: blur(10px);
      }
      .caw-header-controls button:hover { background: rgba(255,255,255,1); }
      .caw-header-controls button svg { width: 18px; height: 18px; }

      .caw-cover {
        width: 100%; height: 140px;
        background: linear-gradient(135deg, ${c} 0%, ${c}dd 100%);
        background-size: auto ${config.coverPhotoZoom}%;
        background-position: center ${config.coverPhotoPosition}%;
        position: relative; transition: all 0.3s ease;
      }
      .caw-cover::before {
        content: ''; position: absolute; inset: 0;
        background: linear-gradient(to bottom, ${c}99 0%, ${c}dd 100%);
        pointer-events: none;
      }

      .caw-header-content {
        text-align: center; padding: 0 20px 16px;
        background: white; transition: all 0.3s ease;
      }
      .caw-header-logo {
        width: 60px; height: 60px; border-radius: 50%;
        background: ${config.logoBackground};
        display: flex; align-items: center; justify-content: center;
        margin: -30px auto 8px; box-shadow: 0 3px 8px rgba(0,0,0,0.12);
        overflow: hidden; position: relative; z-index: 3; flex-shrink: 0;
      }
      .caw-header-logo svg { width: 28px; height: 28px; fill: ${c}; }
      .caw-header-logo img {
        position: absolute;
        width: ${config.logoZoom}%; height: ${config.logoZoom}%;
        left: 50%; top: ${config.logoPosition}%;
        transform: translate(-50%, -${config.logoPosition}%);
        object-fit: contain;
      }
      .caw-header-title {
        font-size: 18px; font-weight: 700; color: #1a1a1a;
        letter-spacing: -0.3px; margin: 0 0 4px;
      }
      .caw-header-subtitle {
        font-size: 13px; color: #666; margin: 0; line-height: 1.4;
      }

      .caw-disclaimer {
        font-size: 11px; color: #555; text-align: center; line-height: 1.4;
        padding: 10px 20px 12px;
        background: rgba(255,243,224,0.5);
        border-bottom: 1px solid rgba(255,152,0,0.15);
        transition: all 0.3s ease;
      }

      .caw-header.minimized {
        background: linear-gradient(135deg, ${c} 0%, ${c}cc 100%);
      }
      .caw-header.minimized .caw-cover { height: 0; overflow: hidden; }
      .caw-header.minimized .caw-header-logo { display: none; }
      .caw-header.minimized .caw-header-content {
        padding: 14px 50px 14px 16px; background: transparent; text-align: left;
      }
      .caw-header.minimized .caw-header-title { color: white; font-size: 15px; margin: 0; }
      .caw-header.minimized .caw-header-subtitle { display: none; }
      .caw-header.minimized .caw-disclaimer { display: none; }
      .caw-header.minimized .caw-header-controls button {
        padding: 6px; background: rgba(255,255,255,0.2); color: white;
      }
      .caw-header.minimized .caw-header-controls button:hover {
        background: rgba(255,255,255,0.35);
      }
      .caw-header.minimized .caw-header-controls button svg {
        stroke: white; fill: none;
      }

      .caw-body {
        flex: 1; overflow-y: auto; overflow-x: hidden;
        padding: 12px; background: #f8f9fa; min-height: 0;
        scroll-behavior: smooth;
        scrollbar-width: thin; scrollbar-color: rgba(0,0,0,0.2) transparent;
      }
      .caw-body::-webkit-scrollbar { width: 6px; }
      .caw-body::-webkit-scrollbar-track { background: transparent; }
      .caw-body::-webkit-scrollbar-thumb { background-color: rgba(0,0,0,0.2); border-radius: 3px; }

      .caw-quick-replies {
        display: flex; flex-wrap: wrap; gap: 6px; justify-content: center;
        padding: 16px 8px;
      }
      .caw-qr {
        padding: 10px 18px; background: white; border: 2px solid #e5e7eb; color: #374151;
        border-radius: 24px; font-size: 14px; font-weight: 500; cursor: pointer;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1); transition: all 0.2s; white-space: nowrap;
      }
      .caw-qr:hover {
        border-color: ${c}; color: ${c}; background: rgba(${rgb},0.08);
        transform: translateY(-1px); box-shadow: 0 4px 6px rgba(0,0,0,0.15);
      }

      .caw-msg {
        margin-bottom: 16px; display: flex; gap: 10px;
        align-items: flex-start; animation: msgIn 0.3s ease-out;
      }
      @keyframes msgIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      .caw-msg.user { flex-direction: row-reverse; }

      .caw-msg-avatar {
        width: 40px; height: 40px; border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        flex-shrink: 0; overflow: hidden; font-size: 16px;
      }
      .caw-msg.user .caw-msg-avatar { background: #e0e0e0; }
      .caw-msg.bot .caw-msg-avatar {
        background: ${config.logo ? config.logoBackground : c};
        ${config.logo ? 'border: 2px solid ' + c + ';' : ''}
      }
      .caw-msg-avatar svg { width: 18px; height: 18px; fill: white; }
      .caw-msg-avatar img {
        width: ${config.logoZoom > 100 ? config.logoZoom : 100}%;
        height: ${config.logoZoom > 100 ? config.logoZoom : 100}%;
        border-radius: 50%; object-fit: contain;
      }
      .caw-msg.user .caw-msg-avatar svg { fill: #666; }

      .caw-msg-content {
        display: flex; flex-direction: column; max-width: 75%; min-width: min-content;
      }
      .caw-msg.user .caw-msg-content { align-items: flex-end; }

      .caw-msg-bubble {
        padding: 14px 18px; word-wrap: break-word; line-height: 1.5;
        position: relative; font-size: 15px; width: fit-content;
        max-width: 100%; letter-spacing: 0.2px;
      }
      .caw-msg.user .caw-msg-bubble {
        background: ${c}; color: white; border-radius: 16px 4px 16px 16px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.08);
      }
      .caw-msg.bot .caw-msg-bubble {
        background: white; color: #1a1a1a; border-radius: 4px 16px 16px 16px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.12);
        border: 1px solid #e5e7eb;
      }
      .caw-msg.bot .caw-msg-bubble strong { color: #111; }
      .caw-msg.bot .caw-msg-bubble a {
        color: ${c}; text-decoration: underline;
      }

      .caw-typing { display: inline-flex; gap: 4px; padding: 0; margin: 0; vertical-align: middle; }
      .caw-typing span {
        width: 8px; height: 8px; background: #999; border-radius: 50%;
        animation: typingBounce 1.4s infinite;
      }
      .caw-typing span:nth-child(2) { animation-delay: 0.2s; }
      .caw-typing span:nth-child(3) { animation-delay: 0.4s; }
      @keyframes typingBounce {
        0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
        30% { opacity: 1; transform: translateY(-8px); }
      }

      .caw-typing-row { display: flex; align-items: center; }
      .caw-typing-label {
        margin-left: 12px; color: #666; font-size: 15px; white-space: nowrap;
        animation: fadeLabel 0.3s ease-out;
      }
      @keyframes fadeLabel { from { opacity: 0; } to { opacity: 1; } }

      .caw-input-container {
        padding: 10px 16px; border-top: 1px solid #e0e0e0;
        background: white; flex-shrink: 0;
      }
      .caw-input-row { display: flex; gap: 8px; align-items: center; }
      .caw-input {
        flex: 1; padding: 14px 18px; border: 2px solid #e5e7eb; border-radius: 24px;
        font-size: 16px; outline: none; font-family: inherit; resize: none;
        min-height: 44px; max-height: 120px; overflow-y: auto; overflow-x: hidden;
        line-height: 1.5; width: 100%; transition: border-color 0.2s;
        scrollbar-width: none; background: white;
      }
      .caw-input:focus { border-color: ${c}; }
      .caw-input::-webkit-scrollbar { width: 0 !important; display: none !important; }
      .caw-send {
        width: 44px; height: 44px; border-radius: 50%; background: ${c}; border: none;
        cursor: pointer; display: flex; align-items: center; justify-content: center;
        flex-shrink: 0; transition: all 0.2s; box-shadow: 0 2px 6px rgba(0,0,0,0.15);
      }
      .caw-send:hover:not(:disabled) { transform: scale(1.05); box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
      .caw-send:disabled { opacity: 0.5; cursor: not-allowed; }
      .caw-send svg { width: 20px; height: 20px; fill: white; }

      .caw-footer {
        padding: 6px 12px; background: #f8f9fa; border-top: 1px solid #e0e0e0;
        flex-shrink: 0; display: flex; align-items: center; justify-content: center;
        font-size: 9px; color: #999;
      }
      .caw-footer a {
        color: ${c}; text-decoration: none; transition: opacity 0.2s;
      }
      .caw-footer a:hover { opacity: 0.7; text-decoration: underline; }
      .caw-footer-divider { color: #d0d0d0; margin: 0 8px; }

      .caw-popup {
        position: absolute; bottom: 75px; ${pos}: 0;
        background: linear-gradient(135deg, #fff 0%, #f8f9fa 100%);
        border-radius: 16px; padding: 14px 18px;
        max-width: 320px; min-width: 240px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.12), 0 4px 8px rgba(0,0,0,0.08);
        border: 1px solid rgba(0,0,0,0.06);
        opacity: 0; transform: translateY(10px) scale(0.95);
        transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        pointer-events: none; font-size: 14px; color: #1a1a1a;
        line-height: 1.5; font-weight: 500; cursor: pointer;
      }
      .caw-popup:hover {
        box-shadow: 0 12px 32px rgba(0,0,0,0.15), 0 6px 12px rgba(0,0,0,0.1);
      }
      .caw-popup.show { opacity: 1; transform: translateY(0) scale(1); pointer-events: auto; }
      .caw-popup-close {
        position: absolute; top: 8px; right: 8px;
        background: rgba(0,0,0,0.05); border: none; padding: 4px 6px;
        border-radius: 4px; cursor: pointer; font-size: 16px; color: #666;
        transition: all 0.2s;
      }
      .caw-popup-close:hover { background: rgba(0,0,0,0.1); color: #333; }

      .caw-feedback {
        display: flex; gap: 4px; margin-top: 6px; padding-left: 2px;
      }
      .caw-feedback-btn {
        background: none; border: none; cursor: pointer; padding: 4px;
        border-radius: 4px; display: flex; align-items: center; transition: all 0.2s;
      }
      .caw-feedback-btn svg {
        width: 14px; height: 14px; fill: none; stroke: #c0c0c0; stroke-width: 2;
        transition: all 0.2s;
      }
      .caw-feedback-btn:hover svg { stroke: #888; }
      .caw-feedback-btn.active svg { stroke: ${c}; fill: ${c}; }
      .caw-feedback-btn.active-down svg { stroke: #ef4444; fill: #ef4444; }
      .caw-feedback-btn:disabled { cursor: default; }

      .caw-feedback-success {
        margin-top: 6px; padding: 6px 10px; background: #f0fdf4;
        border-radius: 8px; font-size: 12px; color: #166534;
        animation: msgIn 0.2s ease-out;
      }

      @media (max-width: 480px) {
        .caw-box {
          position: fixed !important; top: 0; left: 0; right: 0; bottom: 0;
          width: 100% !important; height: 100% !important;
          max-width: 100% !important; max-height: 100% !important;
          border-radius: 0;
        }
        .caw-widget { ${pos}: 12px; bottom: 12px; }
      }
    `;
  }

  function buildHTML() {
    const logoImg = config.logo
      ? `<img src="${escapeHtml(config.logo)}" onerror="this.style.display='none';this.nextElementSibling.style.display='block';" alt=""><svg viewBox="0 0 24 24" style="display:none;"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" fill="${config.primaryColor}"/></svg>`
      : `<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" fill="${config.primaryColor}"/></svg>`;

    const btnLogoHTML = config.logo
      ? `<img src="${escapeHtml(config.logo)}" onerror="this.style.display='none';this.nextElementSibling.style.display='block';" alt=""><svg viewBox="0 0 24 24" style="display:none"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`
      : '<svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>';

    const coverStyle = config.coverPhoto
      ? `background-image:url('${escapeHtml(config.coverPhoto)}');background-size:auto ${config.coverPhotoZoom}%;background-position:center ${config.coverPhotoPosition}%;`
      : '';

    const disclaimerHTML = config.disclaimer
      ? `<div class="caw-disclaimer">${escapeHtml(config.disclaimer)}</div>`
      : '';

    return `
      <div class="caw-widget">
        <button class="caw-btn ${config.enablePulse ? 'pulse' : ''}" id="caw-toggle">
          ${btnLogoHTML}
          <div class="online-dot"></div>
        </button>
        <div class="caw-popup" id="caw-popup">
          <button class="caw-popup-close" id="caw-popup-close">&times;</button>
          <div id="caw-popup-text">${escapeHtml(config.welcomeMessage || 'Jak vám mohu pomoci?')}</div>
        </div>
        <div class="caw-box" id="caw-box">
          <div class="caw-header" id="caw-header">
            <div class="caw-header-controls">
              <button class="caw-close" id="caw-close" aria-label="Zavřít">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div class="caw-cover" id="caw-cover" style="${coverStyle}"></div>
            <div class="caw-header-content">
              <div class="caw-header-logo">${logoImg}</div>
              <h3 class="caw-header-title" id="caw-name">${escapeHtml(config.companyName)} AI</h3>
              <p class="caw-header-subtitle">${escapeHtml(config.welcomeHeadline)}</p>
            </div>
            ${disclaimerHTML}
          </div>
          <div class="caw-body" id="caw-body">
            <div class="caw-quick-replies" id="caw-welcome">${config.quickReplies.map(r => `<button class="caw-qr">${escapeHtml(r)}</button>`).join('')}</div>
          </div>
          <div class="caw-input-container">
            <div class="caw-input-row">
              <textarea class="caw-input" id="caw-input" placeholder="Napište zprávu..." rows="1"></textarea>
              <button class="caw-send" id="caw-send">
                <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
              </button>
            </div>
          </div>
          <div class="caw-footer">
            <span>Powered by</span>
            <span class="caw-footer-divider"></span>
            <a href="https://munipolis.cz" target="_blank" rel="noopener">MUNIPOLIS</a>
          </div>
        </div>
      </div>
    `;
  }

  function render() {
    host = document.createElement('div');
    host.id = 'vasefirma-ai-widget';
    document.body.appendChild(host);
    shadow = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = buildCSS();
    shadow.appendChild(style);

    const wrapper = document.createElement('div');
    wrapper.innerHTML = buildHTML();
    shadow.appendChild(wrapper.firstElementChild);

    const toggle = shadow.getElementById('caw-toggle');
    const box = shadow.getElementById('caw-box');
    const close = shadow.getElementById('caw-close');
    const header = shadow.getElementById('caw-header');
    const body = shadow.getElementById('caw-body');
    const input = shadow.getElementById('caw-input');
    const send = shadow.getElementById('caw-send');
    const welcome = shadow.getElementById('caw-welcome');
    const popup = shadow.getElementById('caw-popup');
    const popupClose = shadow.getElementById('caw-popup-close');

    function toggleWidget() {
      isOpen = !isOpen;
      box.classList.toggle('open', isOpen);
      toggle.classList.toggle('hidden', isOpen);
      if (popup) popup.classList.remove('show');
      if (isOpen) { input.focus(); toggle.classList.remove('pulse'); }
    }

    function minimizeHeader() {
      if (!headerMinimized) {
        headerMinimized = true;
        header.classList.add('minimized');
      }
    }

    header.addEventListener('click', (e) => {
      if (headerMinimized && !e.target.closest('.caw-close')) {
        headerMinimized = false;
        header.classList.remove('minimized');
      }
    });

    toggle.addEventListener('click', toggleWidget);
    close.addEventListener('click', toggleWidget);
    if (popupClose) popupClose.addEventListener('click', (e) => { e.stopPropagation(); popup.classList.remove('show'); });
    if (popup) popup.addEventListener('click', () => { popup.classList.remove('show'); toggleWidget(); });

    shadow.querySelectorAll('.caw-qr').forEach(btn => {
      btn.addEventListener('click', () => {
        input.value = btn.textContent;
        sendMessage();
      });
    });

    async function sendMessage() {
      const text = input.value.trim();
      if (!text || isLoading) return;

      if (welcome && welcome.parentNode) welcome.remove();
      minimizeHeader();

      addMsg(text, 'user');
      input.value = '';
      input.style.height = 'auto';

      isLoading = true;
      send.disabled = true;
      const typing = addTyping();

      try {
        const res = await fetch(`${config.apiBase}/api/query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: text,
            sessionId,
            chatHistory: chatHistory.slice(-10)
          })
        });
        const data = await res.json();
        typing.remove();
        const answer = data.answer || 'Omlouvám se, nastala chyba.';
        addMsg(answer, 'bot');
        chatHistory.push({ text, isUser: true });
        chatHistory.push({ text: answer, isUser: false });
      } catch {
        typing.remove();
        addMsg('Nepodařilo se spojit se serverem. Zkuste to prosím znovu.', 'bot');
      }

      isLoading = false;
      send.disabled = false;
    }

    let lastUserQuestion = '';

    function addMsg(text, type) {
      const el = document.createElement('div');
      el.className = 'caw-msg ' + type;
      const msgId = 'cmsg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
      const avatarHTML = type === 'user'
        ? '<svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>'
        : (config.logo
          ? `<img src="${escapeHtml(config.logo)}" alt="Logo">`
          : '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>');
      const content = type === 'bot' ? renderMarkdown(text) : escapeHtml(text);

      const feedbackHTML = type === 'bot' ? `
        <div class="caw-feedback" data-msgid="${msgId}">
          <button class="caw-feedback-btn" data-rating="up" title="Dobrá odpověď">
            <svg viewBox="0 0 24 24"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
          </button>
          <button class="caw-feedback-btn" data-rating="down" title="Špatná odpověď">
            <svg viewBox="0 0 24 24"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10zM17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>
          </button>
        </div>
      ` : '';

      el.innerHTML = `
        <div class="caw-msg-avatar">${avatarHTML}</div>
        <div class="caw-msg-content">
          <div class="caw-msg-bubble">${content}</div>
          ${feedbackHTML}
        </div>
      `;

      if (type === 'user') lastUserQuestion = text;

      if (type === 'bot') {
        el.querySelectorAll('.caw-feedback-btn').forEach(btn => {
          btn.addEventListener('click', () => handleFeedback(btn, el, msgId, text));
        });
      }

      body.appendChild(el);
      if (type === 'bot') {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        body.scrollTop = body.scrollHeight;
      }
    }

    function handleFeedback(btn, msgEl, msgId, originalAnswer) {
      const feedbackContainer = btn.closest('.caw-feedback');
      const rating = btn.dataset.rating;

      feedbackContainer.querySelectorAll('.caw-feedback-btn').forEach(b => {
        b.disabled = true;
        b.classList.remove('active', 'active-down');
      });
      btn.classList.add(rating === 'up' ? 'active' : 'active-down');

      fetch(`${config.apiBase}/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companySlug: config.company,
          sessionId,
          messageId: msgId,
          rating,
          originalQuestion: lastUserQuestion,
          originalAnswer
        })
      }).catch(() => {});

      const success = document.createElement('div');
      success.className = 'caw-feedback-success';
      success.textContent = rating === 'up' ? 'Děkujeme za hodnocení!' : 'Děkujeme za zpětnou vazbu.';
      feedbackContainer.after(success);
      setTimeout(() => success.remove(), 3000);
    }

    const loadingMessages = [
      'Prohledávám dokumentaci...',
      'Analyzuji dostupné informace...',
      'Hledám nejrelevantnější údaje...',
      'Ověřuji informace...',
      'Připravuji odpověď...'
    ];

    function addTyping() {
      const el = document.createElement('div');
      el.className = 'caw-msg bot';
      const avatarHTML = config.logo
        ? `<img src="${escapeHtml(config.logo)}" alt="">`
        : '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>';
      const labelId = 'caw-tl-' + Date.now();
      el.innerHTML = `
        <div class="caw-msg-avatar">${avatarHTML}</div>
        <div class="caw-msg-content">
          <div class="caw-msg-bubble">
            <div class="caw-typing-row">
              <div class="caw-typing"><span></span><span></span><span></span></div>
              <span class="caw-typing-label" id="${labelId}">${loadingMessages[0]}</span>
            </div>
          </div>
        </div>
      `;
      body.appendChild(el);
      body.scrollTop = body.scrollHeight;

      let idx = 0;
      const interval = setInterval(() => {
        idx = (idx + 1) % loadingMessages.length;
        const label = shadow.getElementById(labelId);
        if (label) {
          label.style.animation = 'none';
          label.offsetHeight;
          label.style.animation = 'fadeLabel 0.3s ease-out';
          label.textContent = loadingMessages[idx];
        }
      }, 3000);

      const origRemove = el.remove.bind(el);
      el.remove = () => { clearInterval(interval); origRemove(); };
      return el;
    }

    send.addEventListener('click', sendMessage);
    input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });

    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    });

    // Auto popup
    if (config.autoPopupDelay > 0 && popup) {
      const popupKey = `caw_popup_${config.company}`;
      const lastPopup = localStorage.getItem(popupKey);
      const today = new Date().toDateString();
      if (lastPopup !== today) {
        setTimeout(() => {
          if (!isOpen) {
            popup.classList.add('show');
            localStorage.setItem(popupKey, today);
            setTimeout(() => popup.classList.remove('show'), 8000);
          }
        }, config.autoPopupDelay);
      }
    }

    if (config.isPreview) setTimeout(toggleWidget, 500);

    window.VaseFirmaAI = {
      open: () => !isOpen && toggleWidget(),
      close: () => isOpen && toggleWidget(),
      toggle: toggleWidget
    };
  }

  async function init() {
    try {
      const res = await fetch(`${config.apiBase}/api/config`);
      if (res.ok) {
        const data = await res.json();
        config.companyName = data.name || config.companyName;
        const wc = data.widgetConfig || {};
        if (wc.primaryColor) config.primaryColor = wc.primaryColor;
        if (wc.logo) config.logo = wc.logo;
        if (wc.logoBackground) config.logoBackground = wc.logoBackground;
        if (wc.logoPosition != null) config.logoPosition = wc.logoPosition;
        if (wc.logoZoom != null) config.logoZoom = wc.logoZoom;
        if (wc.coverPhoto) config.coverPhoto = wc.coverPhoto;
        if (wc.coverPhotoPosition != null) config.coverPhotoPosition = wc.coverPhotoPosition;
        if (wc.coverPhotoZoom != null) config.coverPhotoZoom = wc.coverPhotoZoom;
        if (wc.position && !attrs.position) config.position = wc.position;
        if (wc.welcomeHeadline) config.welcomeHeadline = wc.welcomeHeadline;
        if (wc.welcomeMessage) config.welcomeMessage = wc.welcomeMessage;
        if (wc.disclaimer) config.disclaimer = wc.disclaimer;
        if (Array.isArray(wc.quickReplies) && wc.quickReplies.length > 0) config.quickReplies = wc.quickReplies;
        if (wc.autoPopupDelay != null) config.autoPopupDelay = wc.autoPopupDelay;
        if (wc.enablePulse != null) config.enablePulse = wc.enablePulse;
      }
    } catch (e) {
      console.log('VaseFirma Widget: using default config');
    }

    if (attrs.color) config.primaryColor = attrs.color;
    if (attrs.position) config.position = attrs.position;

    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
