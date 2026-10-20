(() => {
  const audio = document.querySelector("#audio-a");
  const record = document.querySelector("#record");
  const artworkLayers = [document.querySelector("#artwork"), document.querySelector("#artwork-next")];
  const title = document.querySelector("#track-title");
  const artist = document.querySelector("#artist");
  const trackInfo = document.querySelector("#track-info");
  const fill = document.querySelector("#progress-fill");
  const status = document.querySelector("#status");
  const controls = document.querySelector(".controls");
  const volumeButton = document.querySelector("#volume-button");
  const volume = document.querySelector("#volume");
  const player = document.querySelector(".player");
  const startOverlay = document.querySelector("#start-overlay");
  const playlist = window.RADIO_PLAYLIST || [];
  const fallbackArtwork = ["assets/placeholders/1.png", "assets/placeholders/2.png", "assets/placeholders/3.png"];
  let station = null;
  let artworkLayer = 0;
  let artworkRequestId = 0;
  let volumeTimer = 0;
  let rotation = 0;
  let lastFrame = performance.now();
  let clockOffset = 0;
  let transitionId = 0;
  let transitionPending = false;
  let endedNextIndex = -1;

  audio.autoplay = false;
  let storedVolume = NaN;
  try { storedVolume = Number.parseFloat(localStorage.getItem("tydebruyn-radio-volume")); } catch (error) { /* optional preference */ }
  if (Number.isFinite(storedVolume)) volume.value = String(Math.max(0, Math.min(1, storedVolume)));
  audio.volume = Number(volume.value);

  function animateRecord(timestamp) {
    const elapsed = Math.min(100, timestamp - lastFrame);
    lastFrame = timestamp;
    if (!audio.paused && !audio.ended) {
      rotation = (rotation + elapsed * 0.03) % 360;
      record.style.transform = `rotate(${rotation}deg) translateZ(0)`;
    }
    requestAnimationFrame(animateRecord);
  }
  requestAnimationFrame(animateRecord);

  function stateAt(time = Date.now()) {
    const total = playlist.reduce((sum, track) => sum + track.duration, 0);
    if (!playlist.length || !total) return null;
    const elapsed = ((time + clockOffset - window.RADIO_EPOCH_MS) / 1000 % total + total) % total;
    let cursor = 0;
    for (let index = 0; index < playlist.length; index += 1) {
      const track = playlist[index];
      if (elapsed < cursor + track.duration) return { track, index, position: elapsed - cursor };
      cursor += track.duration;
    }
    return { track: playlist[0], index: 0, position: 0 };
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
    artist.textContent = next.track.artist || "Ty deBruyn Radio";
    setArtwork(next);
  }

  function waitForAudioReady(id) {
    return new Promise((resolve) => {
      if (audio.readyState >= 1) {
        resolve(id === transitionId);
        return;
      }
      const finish = (loaded) => {
        audio.removeEventListener("loadedmetadata", onLoaded);
        audio.removeEventListener("error", onError);
        resolve(loaded && id === transitionId);
      };
      const onLoaded = () => finish(true);
      const onError = () => finish(false);
      audio.addEventListener("loadedmetadata", onLoaded, { once: true });
      audio.addEventListener("error", onError, { once: true });
    });
  }

  async function loadTrack(next, shouldPlay) {
    const id = ++transitionId;
    transitionPending = true;
    const url = new URL(next.track.url, window.location.href).href;
    audio.pause();
    if (audio.src !== url) {
      audio.src = next.track.url;
      audio.load();
    }
    const ready = await waitForAudioReady(id);
    if (!ready) {
      if (id === transitionId) {
        transitionPending = false;
        player.classList.remove("is-playing");
        status.textContent = "Audio could not be loaded.";
      }
      return;
    }
    const current = stateAt();
    if (!current || current.index !== next.index) {
      transitionPending = false;
      synchronize(shouldPlay);
      return;
    }
    audio.currentTime = current.position;
    station = next;
    renderTrack(next);
    if (!shouldPlay) {
      transitionPending = false;
      player.classList.remove("is-playing");
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
      player.classList.remove("is-playing");
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
      status.textContent = "The station is not configured with any music yet.";
      startOverlay.classList.add("is-hidden");
      player.classList.remove("is-playing");
      return;
    }
    if (transitionPending || (station && station.index === next.index && audio.src)) return;
    status.textContent = "";
    loadTrack(next, shouldPlay);
  }

  function expectedPosition() {
    const current = stateAt();
    return current && station && current.index === station.index ? current.position : 0;
  }

  async function startAudio() {
    if (transitionPending) return;
    try {
      const position = expectedPosition();
      if (Math.abs((audio.currentTime || 0) - position) > 1.5) audio.currentTime = position;
      await audio.play();
      player.classList.add("is-playing");
      startOverlay.classList.add("is-hidden");
      status.textContent = "";
    } catch (error) {
      status.textContent = "Playback is blocked until the browser allows audio.";
    }
  }

  function synchronize(shouldPlay = false) {
    const next = stateAt();
    if (!next) {
      setTrack(null);
      return;
    }
    const changingTrack = Boolean(station && station.index !== next.index);
    setTrack(next, shouldPlay);
    if (changingTrack || transitionPending) return;
    const position = next.position;
    if (Math.abs((audio.currentTime || 0) - position) > 1.5) audio.currentTime = position;
    if (shouldPlay && audio.paused) startAudio();
  }

  async function synchronizeClock() {
    try {
      const started = Date.now();
      const response = await fetch(`playlist.js?clock=${started}`, { cache: "no-store" });
      const date = response.headers.get("date");
      if (!date) return;
      const midpoint = started + (Date.now() - started) / 2;
      clockOffset = Date.parse(date) - midpoint;
    } catch (error) {
      // The local clock remains the fallback when the hosting response has no Date header.
    }
  }

  function revealVolume() {
    controls.classList.add("volume-open");
    volumeButton.setAttribute("aria-expanded", "true");
    clearTimeout(volumeTimer);
    volumeTimer = setTimeout(() => {
      controls.classList.remove("volume-open");
      volumeButton.setAttribute("aria-expanded", "false");
    }, 2600);
  }

  volumeButton.addEventListener("click", revealVolume);
  volumeButton.addEventListener("pointerdown", startAudio);
  volume.addEventListener("pointerdown", () => { revealVolume(); startAudio(); });
  volume.addEventListener("input", () => {
    audio.volume = Number(volume.value);
    try { localStorage.setItem("tydebruyn-radio-volume", volume.value); } catch (error) { /* optional preference */ }
    revealVolume();
  });
  startOverlay.addEventListener("click", startAudio);
  audio.addEventListener("playing", () => player.classList.add("is-playing"));
  audio.addEventListener("pause", () => player.classList.remove("is-playing"));
  audio.addEventListener("ended", () => {
    const current = stateAt();
    if (station && current && current.index === station.index && playlist.length > 1) {
      endedNextIndex = (station.index + 1) % playlist.length;
      station = null;
      return;
    }
    synchronize(true);
  });
  audio.addEventListener("error", () => {
    if (!transitionPending) status.textContent = "Audio could not be loaded.";
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) synchronize(!audio.paused);
  });
  setInterval(() => {
    const next = stateAt();
    if (!next) return;
    if (endedNextIndex >= 0) {
      if (next.index !== endedNextIndex) return;
      endedNextIndex = -1;
      synchronize(true);
    }
    if (!station || station.index !== next.index) synchronize(!audio.paused);
    fill.style.width = `${Math.min(100, Math.max(0, next.position / next.track.duration * 100))}%`;
    if (!audio.paused && audio.readyState >= 3 && Math.abs(audio.currentTime - next.position) > 4) {
      audio.currentTime = next.position;
    }
  }, 250);

  synchronizeClock().then(() => synchronize(true));
  setInterval(() => synchronizeClock().then(() => synchronize(!audio.paused)), 30000);
})();
