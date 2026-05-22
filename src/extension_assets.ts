export const EXT_MANIFEST = `{
  "manifest_version": 3,
  "name": "REZ AI Meeting Companion",
  "version": "1.0.0",
  "description": "Capture real-time Google Meet stream screens and audio, synchronizing directly with REZ AI Workspace.",
  "permissions": [
    "activeTab",
    "tabCapture",
    "desktopCapture",
    "storage"
  ],
  "host_permissions": [
    "*://*/*"
  ],
  "action": {
    "default_popup": "popup.html",
    "default_title": "REZ AI Companion"
  }
}`;

export const EXT_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>REZ AI Companion</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      width: 320px;
      margin: 0;
      padding: 16px;
      background-color: #F8F7F4;
      color: #1A1A1A;
    }
    .container {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 8px;
      border-b: 1px solid #E5E5E1;
      padding-bottom: 8px;
    }
    .logo {
      background-color: #1A1A1A;
      color: #FFFFFF;
      font-family: Georgia, serif;
      font-weight: bold;
      width: 28px;
      height: 28px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
    }
    .title {
      font-size: 15px;
      font-weight: 700;
      letter-spacing: -0.02em;
    }
    .hint {
      font-size: 11px;
      color: #71716A;
      line-height: 1.4;
      background-color: #FFFFFF;
      border: 1px solid #E5E5E1;
      border-radius: 8px;
      padding: 8px;
    }
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    label {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      color: #71716A;
      letter-spacing: 0.05em;
    }
    input {
      background-color: #FFFFFF;
      border: 1px solid #E5E5E1;
      border-radius: 8px;
      padding: 8px;
      font-size: 12px;
      color: #1A1A1A;
      outline: none;
    }
    input:focus {
      border-color: #1A1A1A;
    }
    .actions {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 4px;
    }
    button {
      background-color: #1A1A1A;
      color: #FFFFFF;
      border: none;
      border-radius: 8px;
      padding: 10px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }
    button:hover {
      background-color: #000000;
    }
    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .btn-secondary {
      background-color: #FFFFFF;
      color: #1A1A1A;
      border: 1px solid #E5E5E1;
    }
    .btn-secondary:hover {
      background-color: #F8F7F4;
    }
    .status-badge {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      font-weight: 600;
      margin-top: 4px;
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background-color: #E5E5E1;
    }
    .dot.active {
      background-color: #10B981;
      box-shadow: 0 0 6px #10B981;
      animation: pulse 1.5s infinite;
    }
    @keyframes pulse {
      0% { opacity: 0.3; }
      50% { opacity: 1; }
      100% { opacity: 0.3; }
    }
    a {
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">R</div>
      <div class="title">REZ AI Companion</div>
    </div>

    <div class="hint">
      Run your Google Meet. Click <strong>Connect & Record</strong> below, grab the correct tab stream, and synchronize live meeting transcriptions to your account securely.
    </div>

    <div class="form-group">
      <label for="serverUrl">Workspace URL</label>
      <input type="text" id="serverUrl" placeholder="https://..." value="">
    </div>

    <div class="form-group">
      <label for="userId">Firebase User UID</label>
      <input type="text" id="userId" placeholder="Enter your User UID (copy from profile)">
    </div>

    <div class="form-group">
      <label for="meetingTitle">Meeting Title</label>
      <input type="text" id="meetingTitle" placeholder="e.g. Google Meet Client sync" value="Google Meet Dialogue">
    </div>

    <div class="status-badge">
      <span id="statusDot" class="dot"></span>
      <span id="statusText">Disconnected</span>
    </div>

    <div class="actions">
      <button id="startBtn">Connect & Record Tab</button>
      <button id="stopBtn" class="btn-secondary" disabled>Stop & Sync Minutes</button>
      <button id="openWorkspaceBtn" class="btn-secondary">Open Workspace</button>
    </div>
  </div>

  <script src="popup.js"></script>
</body>
</html>`;

export const EXT_JS = `// REZ AI chrome extension popup controller
document.addEventListener('DOMContentLoaded', async () => {
  const serverUrlInput = document.getElementById('serverUrl');
  const userIdInput = document.getElementById('userId');
  const meetingTitleInput = document.getElementById('meetingTitle');
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const openWorkspaceBtn = document.getElementById('openWorkspaceBtn');
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');

  // Load from chrome.storage if available
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['serverUrl', 'userId'], (data) => {
      if (data.serverUrl) serverUrlInput.value = data.serverUrl;
      if (data.userId) userIdInput.value = data.userId;
    });
  }

  let mediaRecorder = null;
  let audioChunks = [];
  let stream = null;

  startBtn.addEventListener('click', async () => {
    const serverUrl = serverUrlInput.value.trim();
    const userId = userIdInput.value.trim();
    const title = meetingTitleInput.value.trim();

    if (!serverUrl) {
      alert('Workspace URL is required.');
      return;
    }
    if (!userId) {
      alert('Please enter your Firebase User UID to sync minutes with your account.');
      return;
    }

    try {
      statusText.textContent = "Connecting stream...";
      
      // Request client audio and screen share
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });

      if (stream.getAudioTracks().length === 0) {
        alert("Warning: No audio track detected. To record voices, please toggle 'Share tab audio' or select a tab when sharing your screen.");
      }

      mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      audioChunks = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        statusText.textContent = "Processing and converting audio...";
        statusDot.className = "dot";

        try {
          const audioBlob = new Blob(audioChunks, { type: 'video/webm' });
          const base64Audio = await blobToBase64(audioBlob);

          statusText.textContent = "Uploading to server...";
          
          const response = await fetch(\`\${serverUrl}/api/meetings/upload-audio\`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              userId: userId,
              title: title || \`Google Meet Companion — \${new Date().toLocaleTimeString()}\`,
              platform: "google-meet",
              template: "client",
              base64Audio: base64Audio,
              fileType: "video/webm"
            })
          });

          if (response.ok) {
            statusText.textContent = "Minutes Uploaded Successfully!";
            alert("Success! The meeting audio has been synchronized and Gemini is summarizing your minutes.");
          } else {
            const errData = await response.json();
            throw new Error(errData.error || "Failed server sync.");
          }
        } catch (uploadErr) {
          console.error("Upload error:", uploadErr);
          statusText.textContent = "Upload failed.";
          alert(\`Failed synchronizing meeting: \${uploadErr.message}\`);
        } finally {
          if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
          }
          startBtn.disabled = false;
          stopBtn.disabled = true;
        }
      };

      mediaRecorder.start(100);
      
      statusText.textContent = "Recording Meet Stream Live...";
      statusDot.className = "dot active";
      
      startBtn.disabled = true;
      stopBtn.disabled = false;

    } catch (err) {
      console.error("Could not capture stream:", err);
      statusText.textContent = "Capture failed.";
      statusDot.className = "dot";
      alert("Multimodal capture denied: " + err.message);
    }
  });

  stopBtn.addEventListener('click', () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
  });

  openWorkspaceBtn.addEventListener('click', () => {
    const serverUrl = serverUrlInput.value.trim();
    if (serverUrl) {
      window.open(serverUrl, '_blank');
    }
  });

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const resultStr = reader.result;
        const base64Marker = ";base64,";
        const markerIndex = resultStr.indexOf(base64Marker);
        let base64String = "";
        if (markerIndex !== -1) {
          base64String = resultStr.substring(markerIndex + base64Marker.length);
        } else {
          const firstCommaIndex = resultStr.indexOf(",");
          base64String = firstCommaIndex !== -1 ? resultStr.substring(firstCommaIndex + 1) : resultStr;
        }
        resolve(base64String);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
});`;
