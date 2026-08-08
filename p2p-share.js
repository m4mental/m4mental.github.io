// Live Link Interceptor Guard
window.addEventListener('click', function(e) {
  let target = e.target.closest('a');
  if (target && target.href) {
    if (target.href.includes('m4mental/my-rvb-builder')) {
      target.href = target.href.replace(/nullcpy\/rvb/g, 'm4mental/my-rvb-builder');
    }
    if (target.href.includes('m4mental.github.io')) {
      target.href = target.href.replace(/nullcpy\.github\.io/g, 'm4mental.github.io');
    }
  }
}, true);

let peer = null, peerConn = null, myPinCode = '';
let incomingFileMeta = null, incomingChunks = [];

function generatePin() { return Math.floor(1000 + Math.random() * 9000).toString(); }

function openP2PModal() {
  let modal = document.getElementById('p2pModal');
  if (!modal) {
    injectP2PModalDOM();
    modal = document.getElementById('p2pModal');
  }
  if (modal) modal.style.display = 'flex';
  initP2PPeer();
}

function closeP2PModal() {
  let modal = document.getElementById('p2pModal');
  if (modal) modal.style.display = 'none';
}

function initP2PPeer() {
  if (typeof Peer === 'undefined') {
    const st = document.getElementById('p2pStatus');
    if (st) st.innerText = '⏳ Loading WebRTC engine...';
    setTimeout(initP2PPeer, 500);
    return;
  }
  if (peer && !peer.destroyed && peer.open) return;
  
  myPinCode = 'm4m-' + generatePin();
  const st = document.getElementById('p2pStatus');
  if (st) st.innerText = '⏳ Connecting to P2P Signal Server...';

  // TURN & STUN IceServers for 5G Jio/Airtel CGNAT Traversal
  peer = new Peer(myPinCode, {
    debug: 1,
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' },
        { urls: 'turn:openrelay.metered.ca:80', username: 'openrelay', credential: 'openrelay' },
        { urls: 'turn:openrelay.metered.ca:443', username: 'openrelay', credential: 'openrelay' }
      ]
    }
  });

  peer.on('open', (id) => {
    const el = document.getElementById('myPinDisplay');
    if (el) el.innerText = myPinCode.replace('m4m-', '');
    const st = document.getElementById('p2pStatus');
    if (st) st.innerText = '✅ Device Ready! Share PIN or enter Receiver PIN.';
  });

  peer.on('connection', (conn) => {
    peerConn = conn;
    setupConnListeners();
  });

  peer.on('error', (err) => {
    const st = document.getElementById('p2pStatus');
    if (err.type === 'unavailable-id') {
      if (st) st.innerText = '🔄 Generating fresh PIN...';
      peer.destroy();
      peer = null;
      setTimeout(initP2PPeer, 400);
    } else {
      if (st) st.innerText = 'P2P Status: ' + (err.type || 'Signal issue, retrying...');
    }
  });
}

function setupConnListeners() {
  const el = document.getElementById('p2pStatus');
  if (el) el.innerText = '⚡ Connected to peer device!';
  const dcBtn = document.getElementById('disconnectBtn');
  if (dcBtn) dcBtn.style.display = 'inline-block';

  incomingChunks = [];
  incomingFileMeta = null;

  peerConn.on('data', (data) => {
    if (typeof data === 'string') {
      try {
        const parsed = JSON.parse(data);
        if (parsed.type === 'file-start') {
          incomingFileMeta = parsed;
          incomingChunks = [];
          const st = document.getElementById('p2pStatus');
          if (st) st.innerText = `📥 Receiving ${parsed.name} (0%)...`;
        } else if (parsed.type === 'file-end') {
          const blob = new Blob(incomingChunks, { type: incomingFileMeta.fileType || 'application/octet-stream' });
          const url = URL.createObjectURL(blob);
          const st = document.getElementById('p2pStatus');
          
          let fileBox = document.getElementById('receivedFilesList');
          if (!fileBox) {
            if (st) st.innerHTML = `<b>🎉 Received Files:</b><div id="receivedFilesList" style="margin-top:10px; display:flex; flex-direction:column; gap:8px; align-items:center;"></div>`;
            fileBox = document.getElementById('receivedFilesList');
          }

          if (fileBox) {
            const link = document.createElement('a');
            link.href = url;
            link.download = incomingFileMeta.name;
            link.style = "background:#22c55e; color:#fff; padding:10px 18px; border-radius:8px; text-decoration:none; display:inline-block; font-weight:bold; margin-top:5px;";
            link.innerHTML = `📥 Save ${incomingFileMeta.name} (${(incomingFileMeta.size / (1024*1024)).toFixed(2)} MB)`;
            fileBox.appendChild(link);
          }

          if (st) st.innerText = `🎉 File ${incomingFileMeta.name} received!`;
          incomingChunks = [];
        }
      } catch(e) {}
    } else {
      incomingChunks.push(data);
      if (incomingFileMeta) {
        const receivedBytes = incomingChunks.length * 16384;
        const pct = Math.min(100, Math.round((receivedBytes / incomingFileMeta.size) * 100));
        const st = document.getElementById('p2pStatus');
        if (st) st.innerText = `📥 Receiving ${incomingFileMeta.name} (${pct}%)...`;
      }
    }
  });

  peerConn.on('close', () => {
    const el = document.getElementById('p2pStatus');
    if (el) el.innerText = '🔌 Device disconnected.';
    const dcBtn = document.getElementById('disconnectBtn');
    if (dcBtn) dcBtn.style.display = 'none';
    peerConn = null;
  });
}

function connectToSender() {
  const pinInput = document.getElementById('connectPinInput');
  if (!pinInput) return;
  const pin = pinInput.value.trim();
  if (!pin || pin.length !== 4) { alert('Enter valid 4-digit PIN.'); return; }
  const el = document.getElementById('p2pStatus');
  if (el) el.innerText = '🔄 Connecting to PIN: ' + pin + '...';
  if (!peer || peer.destroyed) initP2PPeer();
  peerConn = peer.connect('m4m-' + pin, { reliable: true });
  peerConn.on('open', setupConnListeners);
}

function disconnectDevice() {
  if (peerConn) {
    peerConn.close();
    peerConn = null;
  }
  const el = document.getElementById('p2pStatus');
  if (el) el.innerText = '🔌 Disconnected cleanly. Generating new PIN...';
  const dcBtn = document.getElementById('disconnectBtn');
  if (dcBtn) dcBtn.style.display = 'none';

  if (peer) {
    peer.destroy();
    peer = null;
  }
  setTimeout(initP2PPeer, 400);
}

async function sendP2PFiles() {
  const fileInput = document.getElementById('p2pFileInput');
  if (!fileInput || !fileInput.files || fileInput.files.length === 0) { alert('Select at least one file.'); return; }
  if (!peerConn || !peerConn.open) { alert('Connect via PIN first.'); return; }
  
  const files = Array.from(fileInput.files);
  const el = document.getElementById('p2pStatus');
  const CHUNK_SIZE = 16384; // 16 KB binary chunks

  for (let fIdx = 0; fIdx < files.length; fIdx++) {
    const file = files[fIdx];
    
    peerConn.send(JSON.stringify({
      type: 'file-start',
      name: file.name,
      fileType: file.type,
      size: file.size
    }));

    const buffer = await file.arrayBuffer();
    let offset = 0;

    while (offset < buffer.byteLength) {
      const chunk = buffer.slice(offset, offset + CHUNK_SIZE);
      peerConn.send(chunk);
      offset += CHUNK_SIZE;

      const pct = Math.min(100, Math.round((offset / buffer.byteLength) * 100));
      if (el) el.innerText = `📤 Sending (${fIdx + 1}/${files.length}): ${file.name} (${pct}%)...`;
      
      if (offset % (CHUNK_SIZE * 15) === 0) {
        await new Promise(r => setTimeout(r, 20));
      }
    }

    peerConn.send(JSON.stringify({ type: 'file-end' }));
    await new Promise(r => setTimeout(r, 300));
  }

  if (el) el.innerText = `🎉 All ${files.length} file(s) sent successfully!`;
}

function injectP2PModalDOM() {
  if (document.getElementById('p2pModal')) return;
  const modalDiv = document.createElement('div');
  modalDiv.id = 'p2pModal';
  modalDiv.style.cssText = 'display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); backdrop-filter:blur(6px); z-index:3000; align-items:center; justify-content:center; padding:15px;';
  modalDiv.innerHTML = `
    <div style="background:#161b22; border:1px solid #30363d; border-radius:18px; max-width:700px; width:100%; max-height:90vh; overflow-y:auto; padding:24px; text-align:center; position:relative; box-shadow:0 25px 50px -12px rgba(0,0,0,0.8);">
      <button onclick="closeP2PModal()" style="position:absolute; top:15px; right:15px; background:#21262d; border:1px solid #30363d; color:#8b949e; width:32px; height:32px; border-radius:8px; font-size:1.1rem; cursor:pointer;">✕</button>
      <div style="font-size:1.5rem; font-weight:800; color:#2dd4bf; margin-bottom:6px;">🚀 Nothing Warp / P2P Multi-File Drop</div>
      <div style="font-size:0.85rem; color:#94a3b8; margin-bottom:20px;">Direct Peer-to-Peer file sharing between Android, iOS, Windows & Mac.<br><b>Select Multiple Files • Zero server uploads • Instant Transfer</b></div>
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:14px; margin-bottom:15px;">
        <div style="background:#0d1117; border:1px solid #21262d; border-radius:12px; padding:16px;">
          <div style="font-weight:700; color:#fff; font-size:0.95rem;">1. Your Device PIN (Receive Files)</div>
          <div id="myPinDisplay" style="font-size:2rem; font-weight:800; color:#38bdf8; letter-spacing:4px; background:#161b22; padding:8px; border-radius:8px; border:1px dashed #30363d; margin:10px 0;">----</div>
        </div>
        <div style="background:#0d1117; border:1px solid #21262d; border-radius:14px; padding:16px;">
          <div style="font-weight:700; color:#fff; font-size:0.95rem;">2. Connect & Send (Enter PIN)</div>
          <input type="number" id="connectPinInput" style="width:100%; background:#161b22; border:1px solid #30363d; color:#fff; font-size:1.1rem; text-align:center; padding:8px; border-radius:8px; margin:8px 0; outline:none;" placeholder="1234">
          <button style="background:#2563eb; color:#fff; border:none; padding:10px; border-radius:8px; font-weight:700; cursor:pointer; width:100%;" onclick="connectToSender()">Connect Device</button>
        </div>
      </div>
      <div style="border:2px dashed #30363d; border-radius:12px; padding:20px; cursor:pointer; background:#0d1117;" onclick="document.getElementById('p2pFileInput').click()">
        <div style="font-size:1.8rem; margin-bottom:4px;">📁</div>
        <div style="font-weight:700; color:#f0f6fc; font-size:0.95rem;">Click to select file(s) (APKs, ZIPs, Videos, Photos)</div>
        <input type="file" id="p2pFileInput" multiple style="display:none;" onchange="sendP2PFiles()">
      </div>
      <div id="p2pStatus" style="margin-top:15px; font-size:0.9rem; font-weight:600; color:#38bdf8;">Status: Ready to connect.</div>
      <div style="margin-top:15px; display:flex; justify-content:center; gap:10px;">
        <button id="disconnectBtn" onclick="disconnectDevice()" style="display:none; background:#dc2626; color:#fff; border:none; padding:8px 16px; border-radius:8px; cursor:pointer; font-weight:bold;">🔌 Disconnect Device</button>
        <button onclick="closeP2PModal()" style="background:#21262d; border:1px solid #30363d; color:#9ca3af; padding:8px 16px; border-radius:8px; cursor:pointer; font-weight:bold;">Close Window</button>
      </div>
    </div>
  `;
  document.body.appendChild(modalDiv);
}

document.addEventListener('DOMContentLoaded', injectP2PModalDOM);
