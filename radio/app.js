(() => {
  const audio = document.querySelector("#audio-a");
  const record = document.querySelector("#record");
  const artworkLayers = [document.querySelector("#artwork"), document.querySelector("#artwork-next")];
  const title = document.querySelector("#track-title-text");
  const titleRow = document.querySelector("#track-title");
  const skipButton = document.querySelector("#skip-button");
  const artist = document.querySelector("#artist");
  const trackInfo = document.querySelector("#track-info");
  const fill = document.querySelector("#progress-fill");
  const upNext = document.querySelector("#up-next");
  const status = document.querySelector("#status");
  const player = document.querySelector(".player");
  const startOverlay = document.querySelector("#start-overlay");
  const startOverlayText = startOverlay.querySelector("span");
  const tapeStop = new Audio("assets/tapestop.mp3");
  const playlist = window.RADIO_PLAYLIST || [];
  const fallbackArtwork = ["assets/placeholders/1.png", "assets/placeholders/2.png", "assets/placeholders/3.png"];
  let station = null;
  let artworkLayer = 0;
  let artworkRequestId = 0;
  let rotation = 0;
  let lastFrame = performance.now();
  let transitionId = 0;
  let transitionPending = false;
  let handledEndedSource = "";
  let playbackStopped = false;
  let playbackGeneration = 0;
  let initialPositionPending = false;
  let skipTimer = 0;
  let audioContext = null;
  let analyser = null;
  let frequencyData = null;
  let audioLevel = 0;

  audio.autoplay = false;
  tapeStop.preload = "auto";

  function animateRecord(timestamp) {
    const elapsed = Math.min(100, timestamp - lastFrame);
    lastFrame = timestamp;
    if (!audio.paused && !audio.ended) {
      rotation = (rotation + elapsed * 0.03) % 360;
      record.style.transform = `rotate(${rotation}deg) translateZ(0)`;
    }
    if (analyser && frequencyData) {
      analyser.getByteFrequencyData(frequencyData);
      const startBin = 1;
      const sampleSize = Math.min(12, frequencyData.length - startBin);
      let total = 0;
      for (let index = startBin; index < startBin + sampleSize; index += 1) total += frequencyData[index];
      const targetLevel = total / sampleSize / 255;
      audioLevel += (targetLevel - audioLevel) * (targetLevel > audioLevel ? .32 : .16);
      document.documentElement.style.setProperty("--audio-glow", `${4 + audioLevel * 50}px`);
      document.documentElement.style.setProperty("--audio-opacity", `${12 + audioLevel * 68}%`);
    }
    requestAnimationFrame(animateRecord);
  }
  requestAnimationFrame(animateRecord);

  async function setupAudioAnalyser() {
    if (!audioContext) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      audioContext = new AudioContext();
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      frequencyData = new Uint8Array(analyser.frequencyBinCount);
      audioContext.createMediaElementSource(audio).connect(analyser);
      analyser.connect(audioContext.destination);
    }
    if (audioContext.state === "suspended") await audioContext.resume();
  }

  function randomStart() {
    if (!playlist.length) return null;
    const index = Math.floor(Math.random() * playlist.length);
    const track = playlist[index];
    const playableWindow = Math.max(0, track.duration - 10);
    const position = playableWindow ? 5 + Math.random() * playableWindow : 0;
    return { track, index, position };
  }

  function setArtwork(next) {
    const requestId = ++artworkRequestId;
    const nextLayer = (artworkLayer + 1) % 2;
    const image = artworkLayers[nextLayer];
    const fallback = fallbackArtwork[next.index % fallbackArtwork.length];
    image.onload = () => {
      if (requestId !== artworkRequestId) return;
      image.classList.add("is-visible");
      artworkLayers[artworkLayer].classList.remove("is-visible");
      artworkLayer = nextLayer;
    };
    image.onerror = () => {
      if (requestId !== artworkRequestId) return;
      image.onerror = null;
      image.src = fallback;
    };
    image.classList.remove("is-visible");
    image.src = next.track.artwork || fallback;
  }

  function renderTrack(next) {
    trackInfo.classList.remove("is-transitioning");
    void trackInfo.offsetWidth;
    trackInfo.classList.add("is-transitioning");
    title.textContent = next.track.title || "Untitled track";
    skipButton.classList.remove("is-visible");
    window.clearTimeout(skipTimer);
    skipTimer = window.setTimeout(() => skipButton.classList.add("is-visible"), 10000);
    artist.textContent = next.track.artist || "Ty deBruyn Radio";
    const nextTrack = playlist[(next.index + 1) % playlist.length];
    upNext.textContent = nextTrack ? `UP NEXT: ${nextTrack.title || "Untitled track"}` : "UP NEXT: None";
    setArtwork(next);
    fitTitle();
  }

  function fitTitle() {
    titleRow.style.fontSize = "";
    if (window.matchMedia("(max-width: 699px)").matches) {
      title.style.whiteSpace = "normal";
      title.style.overflow = "visible";
      let fontSize = parseFloat(getComputedStyle(titleRow).fontSize);
      for (let attempt = 0; attempt < 20; attempt += 1) {
        const style = getComputedStyle(title);
        const lineHeight = parseFloat(style.lineHeight);
        if (title.scrollHeight <= lineHeight * 2.05 || fontSize <= 18) break;
        fontSize = Math.max(18, fontSize * .9);
        titleRow.style.fontSize = `${fontSize}px`;
      }
      return;
    }
    const rowStyle = getComputedStyle(titleRow);
    const availableWidth = titleRow.clientWidth - parseFloat(rowStyle.paddingLeft) - parseFloat(rowStyle.paddingRight);
    const gap = parseFloat(getComputedStyle(titleRow).columnGap) || 0;
    if (availableWidth <= 0) return;
    title.style.whiteSpace = "nowrap";
    title.style.overflow = "hidden";
    let fontSize = parseFloat(getComputedStyle(titleRow).fontSize);
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const requiredWidth = title.scrollWidth + skipButton.offsetWidth + gap;
      if (requiredWidth <= availableWidth || fontSize <= 18) break;
      fontSize = Math.max(18, fontSize * availableWidth / requiredWidth);
      titleRow.style.fontSize = `${fontSize}px`;
    }
    if (title.scrollWidth + skipButton.offsetWidth + gap > availableWidth) {
      title.style.whiteSpace = "normal";
      title.style.overflow = "visible";
    }
  }

  function waitForAudioReady(id) {
    return new Promise((resolve) => {
      if (audio.readyState >= 3) {
        resolve(id === transitionId);
        return;
      }
      const finish = (loaded) => {
        audio.removeEventListener("canplay", onLoaded);
        audio.removeEventListener("error", onError);
        resolve(loaded && id === transitionId);
      };
      const onLoaded = () => finish(true);
      const onError = () => finish(false);
      audio.addEventListener("canplay", onLoaded, { once: true });
      audio.addEventListener("error", onError, { once: true });
    });
  }

  async function loadTrack(next, shouldPlay) {
    const id = ++transitionId;
    transitionPending = true;
    const url = new URL(next.track.url, window.location.href).href;
    audio.pause();
    handledEndedSource = "";
    if (audio.src !== url) {
      audio.src = next.track.url;
      audio.load();
    }
    const ready = await waitForAudioReady(id);
    if (id !== transitionId) return;
    if (!ready) {
      transitionPending = false;
      player.classList.remove("is-playing");
      status.textContent = "Audio could not be loaded.";
      return;
    }
    audio.currentTime = next.position;
    station = next;
    renderTrack(next);
    if (!shouldPlay) {
      transitionPending = false;
      player.classList.remove("is-playing");
      showStartOverlay();
      return;
    }
    try {
      await audio.play();
      if (id !== transitionId) return;
      player.classList.add("is-playing");
      startOverlay.classList.add("is-hidden");
      status.textContent = "";
      transitionPending = false;
    } catch (error) {
      transitionPending = false;
      if (id !== transitionId) return;
      player.classList.remove("is-playing");
      showStartOverlay();
      status.textContent = "Playback is blocked until the browser allows audio.";
    }
  }

  function setTrack(next, shouldPlay = false) {
    if (!next) {
      station = null;
      audio.pause();
      audio.removeAttribute("src");
      title.textContent = "Ty deBruyn Radio";
      artist.textContent = "Add tracks to radio/playlist.js";
      upNext.textContent = "UP NEXT: None";
      status.textContent = "The station is not configured with any music yet.";
      startOverlay.classList.add("is-hidden");
      skipButton.classList.remove("is-visible");
      window.clearTimeout(skipTimer);
      player.classList.remove("is-playing");
      return;
    }
    if (transitionPending || (station && station.index === next.index && audio.src)) return;
    status.textContent = "";
    loadTrack(next, shouldPlay);
  }

  async function startAudio() {
    if (transitionPending) return;
    const generation = ++playbackGeneration;
    playbackStopped = false;
    try {
      await setupAudioAnalyser();
      if (generation !== playbackGeneration || playbackStopped) return;
      const current = station;
      if (!current) return;
      if (!audio.src) return;
      if (initialPositionPending) {
        audio.currentTime = current.position;
        initialPositionPending = false;
      }
      if (audio.ended) audio.currentTime = 0;
      await audio.play();
      if (generation !== playbackGeneration || playbackStopped) {
        audio.pause();
        return;
      }
      player.classList.add("is-playing");
      startOverlay.classList.add("is-hidden");
      status.textContent = "";
    } catch (error) {
      if (generation !== playbackGeneration || playbackStopped) return;
      status.textContent = "Playback is blocked until the browser allows audio.";
    }
  }

  function showStartOverlay() {
    startOverlay.classList.remove("is-hidden");
    startOverlayText.classList.remove("is-entering");
    void startOverlayText.offsetWidth;
    startOverlayText.classList.add("is-entering");
  }

  function skipTrack() {
    if (transitionPending || !station || playlist.length < 2) return;
    const nextIndex = (station.index + 1) % playlist.length;
    loadTrack({ track: playlist[nextIndex], index: nextIndex, position: 0 }, !audio.paused);
  }

  async function stopPlayback() {
    playbackGeneration += 1;
    transitionId += 1;
    transitionPending = false;
    playbackStopped = true;
    audio.pause();
    player.classList.remove("is-playing");
    showStartOverlay();
    status.textContent = "";
    tapeStop.currentTime = 0;
    try {
      await tapeStop.play();
    } catch (error) {
      status.textContent = "Tape-stop sound could not be played.";
    }
  }

  startOverlay.addEventListener("click", startAudio);
  skipButton.addEventListener("click", skipTrack);
  record.addEventListener("click", stopPlayback);
  audio.addEventListener("playing", () => player.classList.add("is-playing"));
  audio.addEventListener("pause", () => player.classList.remove("is-playing"));
  audio.addEventListener("ended", () => {
    if (playbackStopped) return;
    if (handledEndedSource === audio.currentSrc) return;
    handledEndedSource = audio.currentSrc;
    if (station) {
      const nextIndex = (station.index + 1) % playlist.length;
      loadTrack({ track: playlist[nextIndex], index: nextIndex, position: 0 }, true);
      return;
    }
  });
  audio.addEventListener("error", () => {
    if (!transitionPending) status.textContent = "Audio could not be loaded.";
  });
  setInterval(() => {
    if (!station) return;
    fill.style.width = `${Math.min(100, Math.max(0, audio.duration ? audio.currentTime / audio.duration * 100 : 0))}%`;
  }, 250);

  window.addEventListener("resize", fitTitle);
  const initialTrack = randomStart();
  if (initialTrack) {
    initialPositionPending = true;
    loadTrack(initialTrack, false);
  }
  else setTrack(null);
})();
