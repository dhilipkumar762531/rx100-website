(() => {
  const TOTAL_FRAMES = 238;
  const IMAGE_BASE_PATH = './images/ezgif-frame-';
  const IMAGE_EXT = '.jpg';

  const canvas = document.getElementById('animation-canvas');
  const ctx = canvas.getContext('2d', { alpha: false });

  // Array to cache HTMLImageElements
  const images = new Array(TOTAL_FRAMES);
  const loadedFlags = new Array(TOTAL_FRAMES).fill(false);
  const loadPromises = new Array(TOTAL_FRAMES);

  let currentFrame = 0;
  let targetFrame = 0;
  let lastRenderedFrame = -1;
  let isLoopRunning = false;

  // Format frame index 0..237 to 001..238
  function getFrameUrl(index) {
    const frameNumber = String(index + 1).padStart(3, '0');
    return `${IMAGE_BASE_PATH}${frameNumber}${IMAGE_EXT}`;
  }

  // Preload an individual image with off-thread decode and memoization
  function loadImage(index) {
    if (loadedFlags[index] && images[index]) {
      return Promise.resolve(images[index]);
    }
    if (loadPromises[index]) {
      return loadPromises[index];
    }

    loadPromises[index] = new Promise((resolve) => {
      const img = new Image();
      img.src = getFrameUrl(index);

      const markReady = () => {
        images[index] = img;
        loadedFlags[index] = true;
        resolve(img);
      };

      if (img.decode) {
        img.decode().then(markReady).catch(markReady);
      } else {
        img.onload = markReady;
        img.onerror = markReady;
      }
    });

    return loadPromises[index];
  }

  // Find nearest loaded frame to guarantee zero blank or flickering frames
  function getNearestLoadedImage(index) {
    if (loadedFlags[index] && images[index]) {
      return images[index];
    }
    for (let offset = 1; offset < TOTAL_FRAMES; offset++) {
      const prev = index - offset;
      if (prev >= 0 && loadedFlags[prev] && images[prev]) {
        return images[prev];
      }
      const next = index + offset;
      if (next < TOTAL_FRAMES && loadedFlags[next] && images[next]) {
        return images[next];
      }
    }
    return null;
  }

  // Draw frame on canvas with aspect-ratio preserving cover fit
  function render(index) {
    if (!loadedFlags[index]) {
      loadImage(index).then(() => {
        if (Math.min(TOTAL_FRAMES - 1, Math.max(0, Math.round(currentFrame))) === index) {
          render(index);
        }
      });
    }

    const img = getNearestLoadedImage(index);
    if (!img) return;

    const cw = canvas.width;
    const ch = canvas.height;
    const iw = img.naturalWidth || 1280;
    const ih = img.naturalHeight || 720;

    // Aspect ratio "cover" calculation
    const scale = Math.max(cw / iw, ch / ih);
    const nw = Math.round(iw * scale);
    const nh = Math.round(ih * scale);
    const cx = Math.round((cw - nw) / 2);
    const cy = Math.round((ch - nh) / 2);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, cx, cy, nw, nh);
  }

  // Smooth lerp loop with requestAnimationFrame
  function animationLoop() {
    const diff = targetFrame - currentFrame;

    // Silk-smooth damping interpolation
    if (Math.abs(diff) > 0.001) {
      currentFrame += diff * 0.09;
    } else {
      currentFrame = targetFrame;
    }

    const frameToRender = Math.min(
      TOTAL_FRAMES - 1,
      Math.max(0, Math.round(currentFrame))
    );

    if (frameToRender !== lastRenderedFrame) {
      render(frameToRender);
      lastRenderedFrame = frameToRender;
    }

    if (Math.abs(targetFrame - currentFrame) > 0.001) {
      requestAnimationFrame(animationLoop);
    } else {
      isLoopRunning = false;
    }
  }

  // Calculate target frame from scroll position
  function onScroll() {
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;
    const fraction = maxScroll > 0 ? Math.max(0, Math.min(1, scrollY / maxScroll)) : 0;

    targetFrame = fraction * (TOTAL_FRAMES - 1);

    if (!isLoopRunning) {
      isLoopRunning = true;
      requestAnimationFrame(animationLoop);
    }
  }

  // Handle window resizing and Retina/HiDPI displays
  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);

    if (lastRenderedFrame >= 0) {
      render(lastRenderedFrame);
    }
  }

  // Initialize and preload
  async function init() {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });

    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;
    const fraction = maxScroll > 0 ? Math.max(0, Math.min(1, scrollY / maxScroll)) : 0;
    targetFrame = fraction * (TOTAL_FRAMES - 1);
    currentFrame = targetFrame;
    const initialIndex = Math.min(TOTAL_FRAMES - 1, Math.max(0, Math.round(currentFrame)));

    // 1. Immediately load initial frame and render
    await loadImage(initialIndex);
    render(initialIndex);
    lastRenderedFrame = initialIndex;

    // 2. Preload remaining frames in batches
    const BATCH_SIZE = 8;
    for (let i = 0; i < TOTAL_FRAMES; i += BATCH_SIZE) {
      const batch = [];
      for (let j = i; j < Math.min(i + BATCH_SIZE, TOTAL_FRAMES); j++) {
        if (!loadedFlags[j]) {
          batch.push(loadImage(j));
        }
      }
      if (batch.length > 0) {
        await Promise.all(batch);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

