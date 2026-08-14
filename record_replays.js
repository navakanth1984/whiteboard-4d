const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  console.log('==================================================');
  console.log('📹 RECORDING SPATIAL INTERACTION REPLAYS');
  console.log('==================================================\n');

  const replayDir = path.resolve(__dirname, 'verification/replays/');
  if (!fs.existsSync(replayDir)) {
    fs.mkdirSync(replayDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  
  // Set up context with video recording enabled
  const context = await browser.newContext({
    recordVideo: {
      dir: replayDir,
      size: { width: 800, height: 600 }
    },
    viewport: { width: 800, height: 600 }
  });

  const page = await context.newPage();
  const filePath = path.resolve(__dirname, 'index.html');
  await page.goto(`file://${filePath}`);

  // Inject a small helper to make cursor position visible on screen for the video
  await page.evaluate(() => {
    const cursor = document.createElement('div');
    cursor.id = 'test-cursor';
    cursor.style.position = 'fixed';
    cursor.style.width = '14px';
    cursor.style.height = '14px';
    cursor.style.borderRadius = '50%';
    cursor.style.background = '#ff0055';
    cursor.style.border = '2px solid #fff';
    cursor.style.boxShadow = '0 0 8px rgba(0,0,0,0.5)';
    cursor.style.pointerEvents = 'none';
    cursor.style.zIndex = '99999';
    cursor.style.display = 'none';
    document.body.appendChild(cursor);

    window.showCursor = (x, y) => {
      cursor.style.display = 'block';
      cursor.style.left = `${x - 7}px`;
      cursor.style.top = `${y - 7}px`;
    };
    window.hideCursor = () => {
      cursor.style.display = 'none';
    };
  });

  // Dismiss guide overlay
  await page.evaluate(() => {
    const guide = document.getElementById('guide-overlay');
    if (guide) guide.style.display = 'none';
  });
  await page.waitForTimeout(500);

  // 1. Action: Orbit Camera
  console.log('Action 1: Animating camera orbit...');
  await page.evaluate(async () => {
    let start = performance.now();
    return new Promise(resolve => {
      function tick() {
        const elapsed = performance.now() - start;
        if (elapsed < 2000) {
          const angle = (elapsed / 2000) * Math.PI * 2;
          camera.position.x = 24 * Math.sin(angle);
          camera.position.z = 24 * Math.cos(angle);
          controls.update();
          requestAnimationFrame(tick);
        } else {
          // Reset to home position
          camera.position.set(0, 11, 24);
          controls.target.set(0, 11, -9);
          controls.update();
          resolve();
        }
      }
      tick();
    });
  });
  await page.waitForTimeout(500);

  // 2. Action: Place & Drag Block (SAS Floor Intent)
  console.log('Action 2: Placing and dragging a block (Moving on Floor)...');
  await page.evaluate(() => {
    addBlock(0, 0.5, 0, '#ffcc00');
  });
  await page.waitForTimeout(300);

  // Get screen coordinate of the placed block
  const blockCoord = await page.evaluate(() => {
    const proj = new THREE.Vector3(0, 0.5, 0).project(camera);
    return {
      x: Math.round((proj.x * 0.5 + 0.5) * window.innerWidth),
      y: Math.round((-proj.y * 0.5 + 0.5) * window.innerHeight)
    };
  });

  // Perform pointer drag
  await page.evaluate((coords) => window.showCursor(coords.x, coords.y), blockCoord);
  await page.mouse.move(blockCoord.x, blockCoord.y);
  await page.mouse.down();
  await page.waitForTimeout(200);

  // Move right on screen
  for (let i = 0; i <= 20; i++) {
    const curX = blockCoord.x + (i * 8);
    const curY = blockCoord.y - (i * 3);
    await page.mouse.move(curX, curY);
    await page.evaluate(({x, y}) => window.showCursor(x, y), {x: curX, y: curY});
    await page.waitForTimeout(20);
  }
  await page.waitForTimeout(200);
  await page.mouse.up();
  await page.evaluate(() => window.hideCursor());
  await page.waitForTimeout(500);

  // 3. Action: Shift Override (Following Screen)
  console.log('Action 3: Dragging with Shift key override (Following Screen)...');
  await page.evaluate((coords) => window.showCursor(coords.x, coords.y), blockCoord);
  await page.mouse.move(blockCoord.x, blockCoord.y);
  await page.mouse.down();
  await page.keyboard.down('Shift');
  await page.waitForTimeout(200);

  // Drag upward
  for (let i = 0; i <= 20; i++) {
    const curX = blockCoord.x;
    const curY = blockCoord.y - (i * 10);
    await page.mouse.move(curX, curY);
    await page.evaluate(({x, y}) => window.showCursor(x, y), {x: curX, y: curY});
    await page.waitForTimeout(20);
  }
  await page.waitForTimeout(200);
  await page.mouse.up();
  await page.keyboard.up('Shift');
  await page.evaluate(() => window.hideCursor());
  await page.waitForTimeout(500);

  // 4. Action: Relative Snap Placement (Place Cube B next to Cube A)
  console.log('Action 4: Snapping Cube B next to Cube A...');
  await page.evaluate(() => {
    // Add second block at starting offset
    addBlock(2, 0.5, 0, '#00ffcc');
  });
  await page.waitForTimeout(300);

  // Get coordinate of Cube B
  const blockBCoord = await page.evaluate(() => {
    const proj = new THREE.Vector3(2, 0.5, 0).project(camera);
    return {
      x: Math.round((proj.x * 0.5 + 0.5) * window.innerWidth),
      y: Math.round((-proj.y * 0.5 + 0.5) * window.innerHeight)
    };
  });

  await page.evaluate((coords) => window.showCursor(coords.x, coords.y), blockBCoord);
  await page.mouse.move(blockBCoord.x, blockBCoord.y);
  await page.mouse.down();
  await page.waitForTimeout(200);

  // Drag Cube B closer to Cube A (move left on screen)
  for (let i = 0; i <= 20; i++) {
    const curX = blockBCoord.x - (i * 7);
    const curY = blockBCoord.y;
    await page.mouse.move(curX, curY);
    await page.evaluate(({x, y}) => window.showCursor(x, y), {x: curX, y: curY});
    await page.waitForTimeout(20);
  }
  await page.waitForTimeout(200);
  await page.mouse.up();
  await page.evaluate(() => window.hideCursor());
  await page.waitForTimeout(1000);

  // Clean up and close browser
  await context.close();
  await browser.close();

  // Find generated video file and rename it
  const files = fs.readdirSync(replayDir);
  const videoFile = files.find(f => f.endsWith('.webm'));
  if (videoFile) {
    const oldPath = path.join(replayDir, videoFile);
    const newPath = path.join(replayDir, 'spatial_interactions.webm');
    if (fs.existsSync(newPath)) {
      fs.unlinkSync(newPath);
    }
    fs.renameSync(oldPath, newPath);
    console.log(`\n✓ Saved interaction replay video: ${newPath}`);
  }

  console.log('✅ REPLAY RECORDING COMPLETE');
})();
