// REZ AI chrome extension popup controller
document.addEventListener('DOMContentLoaded', async () => {
  const serverUrlInput = document.getElementById('serverUrl');
  const userIdInput = document.getElementById('userId');
  const meetingTitleInput = document.getElementById('meetingTitle');
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const openWorkspaceBtn = document.getElementById('openWorkspaceBtn');
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');

  // Auto detect current server URL from chrome environment or default
  let defaultUrl = window.location.origin;
  if (defaultUrl.startsWith('chrome-extension')) {
    defaultUrl = 'https://ais-dev-cnjnfnpc4r4ycakfaceqao-23989479005.asia-east1.run.app'; // templated fallback
  }
  serverUrlInput.value = defaultUrl;

  // Load from chrome.storage if available
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['serverUrl', 'userId'], (data) => {
      if (data.serverUrl) serverUrlInput.value = data.serverUrl;
      if (data.userId) userIdInput.value = data.userId;
    });
  } else {
    // Fallback local storage
    const savedUrl = localStorage.getItem('rez_server_url');
    const savedUser = localStorage.getItem('rez_user_id');
    if (savedUrl) serverUrlInput.value = savedUrl;
    if (savedUser) userIdInput.value = savedUser;
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

    // Save configuration
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ serverUrl, userId });
    } else {
      localStorage.setItem('rez_server_url', serverUrl);
      localStorage.setItem('rez_user_id', userId);
    }

    try {
      statusText.textContent = "Connecting stream...";
      
      // Request client audio and screen share
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });

      // Filter only audio tracks
      if (stream.getAudioTracks().length === 0) {
        // Warn if they forgot to tick "Share tab audio"
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
          
          const response = await fetch(`${serverUrl}/api/meetings/upload-audio`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              userId: userId,
              title: title || `Google Meet Companion — ${new Date().toLocaleTimeString()}`,
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
          alert(`Failed synchronizing meeting: ${uploadErr.message}`);
        } finally {
          // Stop all stream tracks to clear record indicator
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

  // Helper inside browser extension popup to build inline base64 string
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
});
