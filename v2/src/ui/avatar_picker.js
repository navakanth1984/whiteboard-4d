import { GENDERS, SKIN_TONES, avatarConfig, setAvatarConfig, loadCustomAvatar } from '../nav/character.js';
import { povMode, setPOVMode } from '../nav/gamer_nav.js';

export function initAvatarPickerUI() {
  const btnAvatar = document.getElementById('btn-avatar-profile');
  const modal = document.getElementById('avatar-modal');
  const btnClose = document.getElementById('avatar-modal-close');

  if (btnAvatar && modal) {
    btnAvatar.addEventListener('click', () => {
      modal.style.display = 'flex';
      renderAvatarModalContent();
    });
  }

  if (btnClose && modal) {
    btnClose.addEventListener('click', () => {
      modal.style.display = 'none';
    });
  }

  // Also wire direct POV buttons if present in header
  document.querySelectorAll('.pov-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.pov;
      if (mode) {
        setPOVMode(mode);
        updatePOVUI();
      }
    });
  });
}

export function updatePOVUI() {
  document.querySelectorAll('.pov-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.pov === povMode);
  });
  const lbl = document.getElementById('current-pov-lbl');
  if (lbl) lbl.textContent = povMode.toUpperCase();
}

function renderAvatarModalContent() {
  const container = document.getElementById('avatar-modal-body');
  if (!container) return;

  container.innerHTML = `
    <!-- Execution Mode Toggle -->
    <div class="av-section">
      <div class="av-sec-title">⚡ Execution Engine Mode</div>
      <div class="av-toggle-row">
        <button class="av-mode-btn ${avatarConfig.executionMode === 'avatar' ? 'active' : ''}" data-exec="avatar">
          <span class="material-symbols-outlined">person_play</span>
          <div>
            <strong>In-World Avatar</strong>
            <small>Avatar physically sketches & projects cards</small>
          </div>
        </button>
        <button class="av-mode-btn ${avatarConfig.executionMode === 'direct' ? 'active' : ''}" data-exec="direct">
          <span class="material-symbols-outlined">bolt</span>
          <div>
            <strong>Direct Placement</strong>
            <small>Instant cursor creation on canvas</small>
          </div>
        </button>
      </div>
    </div>

    <!-- Camera Viewport Perspective -->
    <div class="av-section">
      <div class="av-sec-title">🎥 Gamer Camera POV</div>
      <div class="av-grid-3">
        <button class="av-pov-choice ${avatarConfig.povMode === 'fps' ? 'active' : ''}" data-pov="fps">
          <span class="material-symbols-outlined">visibility</span>
          <span>1st Person (FPS)</span>
        </button>
        <button class="av-pov-choice ${avatarConfig.povMode === 'tps' ? 'active' : ''}" data-pov="tps">
          <span class="material-symbols-outlined">accessibility_new</span>
          <span>3rd Person (TPS)</span>
        </button>
        <button class="av-pov-choice ${avatarConfig.povMode === 'orbit' ? 'active' : ''}" data-pov="orbit">
          <span class="material-symbols-outlined">orbit</span>
          <span>Studio Orbit</span>
        </button>
      </div>
    </div>

    <!-- Gender Identity Selection -->
    <div class="av-section">
      <div class="av-sec-title">👤 Avatar Identity & AccuRig Pipeline</div>
      <div class="av-grid-3">
        ${Object.keys(GENDERS).map(g => `
          <button class="av-gender-choice ${avatarConfig.gender === g ? 'active' : ''}" data-gender="${g}">
            <strong>${GENDERS[g].label}</strong>
          </button>
        `).join('')}
      </div>
    </div>

    <!-- AccuRig / Custom Skinned Avatar Upload -->
    <div class="av-section">
      <div class="av-sec-title">🤖 AccuRig / Custom Skinned Avatar (.glb / .gltf)</div>
      <div class="av-upload-row" style="display:flex;gap:10px;align-items:center;">
        <button class="av-upload-btn" id="btn-upload-avatar" style="flex:1;padding:10px;background:rgba(56,189,248,0.15);border:1px solid rgba(56,189,248,0.35);border-radius:8px;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;font-size:13px;">
          <span class="material-symbols-outlined">upload_file</span>
          <span>Import Custom AccuRig / glTF Rigged Avatar</span>
        </button>
        <input type="file" id="input-avatar-file" accept=".glb,.gltf" style="display:none;">
      </div>
    </div>

    <!-- Skin Tone Customization -->
    <div class="av-section">
      <div class="av-sec-title">🎨 Skin Tone & Finish</div>
      <div class="av-color-row">
        ${SKIN_TONES.map(c => `
          <div class="av-swatch ${avatarConfig.skinTone === c ? 'active' : ''}" style="background:${c}" data-skin="${c}"></div>
        `).join('')}
      </div>
    </div>

    <!-- Movement Controls Help -->
    <div class="av-section av-help-box">
      <div class="av-sec-title">🎮 6-DOF Gamer Navigation Controls</div>
      <div class="av-keys-grid">
        <div><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> Move & Strafe</div>
        <div><kbd>Space</kbd> / <kbd>C</kbd> Elevate Up / Down</div>
        <div><kbd>Shift</kbd> Sprint Flight</div>
        <div><kbd>Right Mouse Drag</kbd> Free Look</div>
        <div><kbd>F</kbd> Focus Camera on Object</div>
        <div><kbd>G</kbd> / <kbd>R</kbd> / <kbd>S</kbd> 3D Move / Rotate / Scale</div>
      </div>
    </div>
  `;

  // Attach event listeners inside modal
  container.querySelectorAll('.av-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setAvatarConfig({ executionMode: btn.dataset.exec });
      renderAvatarModalContent();
    });
  });

  container.querySelectorAll('.av-pov-choice').forEach(btn => {
    btn.addEventListener('click', () => {
      setPOVMode(btn.dataset.pov);
      setAvatarConfig({ povMode: btn.dataset.pov });
      updatePOVUI();
      renderAvatarModalContent();
    });
  });

  container.querySelectorAll('.av-gender-choice').forEach(btn => {
    btn.addEventListener('click', () => {
      setAvatarConfig({ gender: btn.dataset.gender });
      renderAvatarModalContent();
    });
  });

  container.querySelectorAll('.av-swatch').forEach(btn => {
    btn.addEventListener('click', () => {
      setAvatarConfig({ skinTone: btn.dataset.skin });
      renderAvatarModalContent();
    });
  });

  const upBtn = container.querySelector('#btn-upload-avatar');
  const upInput = container.querySelector('#input-avatar-file');
  if (upBtn && upInput) {
    upBtn.addEventListener('click', () => upInput.click());
    upInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        loadCustomAvatar(file, () => {
          renderAvatarModalContent();
        });
      }
    });
  }
}
