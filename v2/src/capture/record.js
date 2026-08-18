let mediaRec = null;
let recChunks = [];
let recActive = false;
let compRAF = null;
let recStart = 0;
let recTimer = null;
let camStream = null;
let micStream = null;
let compCanvas = null;
let compCtx = null;
let camVideoEl = null;

let audioRec = null;
let audioChunks = [];
let audioRecActive = false;

export async function startRecording(withMic = true, withCam = false, onStatusChange) {
  if (recActive) return;
  const canvas = document.getElementById('c');
  if (!canvas) return;

  try {
    let videoStream;
    if (withCam) {
      camStream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      camVideoEl = document.getElementById('webcam-pip');
      if (camVideoEl) {
        camVideoEl.srcObject = camStream;
        camVideoEl.style.display = 'block';
        await camVideoEl.play();
      }

      compCanvas = document.createElement('canvas');
      compCanvas.width = canvas.clientWidth * (window.devicePixelRatio || 1);
      compCanvas.height = canvas.clientHeight * (window.devicePixelRatio || 1);
      compCtx = compCanvas.getContext('2d');

      const draw = () => {
        compCtx.drawImage(canvas, 0, 0, compCanvas.width, compCanvas.height);
        if (camVideoEl && camVideoEl.videoWidth) {
          const cw = compCanvas.width * 0.22;
          const ch = cw * (camVideoEl.videoHeight / camVideoEl.videoWidth);
          const x = compCanvas.width - cw - 20;
          const y = compCanvas.height - ch - 20;
          compCtx.save();
          compCtx.translate(x + cw, y);
          compCtx.scale(-1, 1);
          compCtx.drawImage(camVideoEl, 0, 0, cw, ch);
          compCtx.restore();
          compCtx.strokeStyle = 'rgba(220,80,80,.8)';
          compCtx.lineWidth = 3;
          compCtx.strokeRect(x, y, cw, ch);
        }
        compRAF = requestAnimationFrame(draw);
      };
      draw();
      videoStream = compCanvas.captureStream(30);
    } else {
      videoStream = canvas.captureStream(30);
    }

    const tracks = [...videoStream.getVideoTracks()];
    if (withMic) {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      tracks.push(...micStream.getAudioTracks());
    }

    const combined = new MediaStream(tracks);
    let mime = 'video/webm;codecs=vp9,opus';
    let ext = 'webm';

    if (MediaRecorder.isTypeSupported('video/mp4')) {
      mime = 'video/mp4';
      ext = 'mp4';
    } else if (!MediaRecorder.isTypeSupported(mime)) {
      mime = 'video/webm';
    }

    mediaRec = new MediaRecorder(combined, { mimeType: mime });
    recChunks = [];

    mediaRec.ondataavailable = e => {
      if (e.data && e.data.size) recChunks.push(e.data);
    };

    mediaRec.onstop = () => {
      const blob = new Blob(recChunks, { type: mime.split(';')[0] });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `bleuuboard-recording-${Date.now()}.${ext}`;
      a.click();
      if (typeof onStatusChange === 'function') onStatusChange('stopped');
    };

    mediaRec.start(200);
    recActive = true;
    recStart = Date.now();
    if (typeof onStatusChange === 'function') onStatusChange('started');
  } catch (e) {
    console.error('Recording failed:', e);
    stopRecording();
  }
}

export function stopRecording() {
  if (!recActive) return;
  recActive = false;
  if (mediaRec && mediaRec.state !== 'inactive') mediaRec.stop();
  if (compRAF) cancelAnimationFrame(compRAF);
  if (camStream) camStream.getTracks().forEach(t => t.stop());
  if (micStream) micStream.getTracks().forEach(t => t.stop());
  if (camVideoEl) camVideoEl.style.display = 'none';
  if (recTimer) clearInterval(recTimer);
}

export const isRecording = () => recActive;
