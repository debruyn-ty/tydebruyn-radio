(() => {
  const decks = [document.querySelector("#audio-a"), document.querySelector("#audio-b")];
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
  let station = null;
  let activeDeck = 0;
  let artworkLayer = 0;
  let volumeTimer = 0;
  let rotation = 0;
  let lastFrame = performance.now();
  let transitionId = 0;
  let preloadedTrackId = "";
  const fallbackArtwork = ["assets/placeholders/1.png", "assets/placeholders/2.png", "assets/placeholders/3.png"];

  let storedVolume = NaN;
  try { storedVolume = Number.parseFloat(localStorage.getItem("tydebruyn-radio-volume")); } catch (error) { /* optional preference */ }
  if (Number.isFinite(storedVolume)) volume.value = String(Math.max(0, Math.min(1, storedVolume)));
  decks.forEach((deck) => { deck.volume = Number(volume.value); });

  function activeAudio() { return decks[activeDeck]; }
  function animateRecord(timestamp) {
    const elapsed = Math.min(100, timestamp - lastFrame);
    lastFrame = timestamp;
    if (!activeAudio().paused && !activeAudio().ended) {
      rotation = (rotation + elapsed * 0.03) % 360;
      record.style.transform = `rotate(${rotation}deg) translateZ(0)`;
    }
    requestAnimationFrame(animateRecord);
  }
  requestAnimationFrame(animateRecord);

  function stateAt(time = Date.now()) {
    const playlist = window.RADIO_PLAYLIST || [];
    if (!playlist.length) return null;
    const total = playlist.reduce((sum, track) => sum + track.duration, 0);
    if (!total) return null;
    const elapsed = ((time - window.RADIO_EPOCH_MS) / 1000 % total + total) % total;
    let cursor = 0;
    for (let index = 0; index < playlist.length; index += 1) {
      const track = playlist[index];
      if (elapsed < cursor + track.duration) return { track, index, position: elapsed - cursor };
      cursor += track.duration;
    }
    return { track: playlist[0], index: 0, position: 0 };
  }

  function nextTrackFor(current) {
    const playlist = window.RADIO_PLAYLIST || [];
    if (!current || playlist.length < 2) return null;
    const index = (current.index + 1) % playlist.length;
    return { track: playlist[index], index, position: 0 };
  }

  function preloadUpcoming(current) {
    const upcoming = nextTrackFor(current);
    if (!upcoming || preloadedTrackId === upcoming.track.id) return;
    const preloadDeck = decks[(activeDeck + 1) % 2];
    preloadedTrackId = upcoming.track.id;
    const url = new URL(upcoming.track.url, window.location.href).href;
    if (preloadDeck.src !== url) {
      preloadDeck.src = upcoming.track.url;
      preloadDeck.load();
    }
    if (upcoming.track.artwork) {
      const image = new Image();
      image.decoding = "async";
      image.src = upcoming.track.artwork;
    }
  }

  function setArtwork(next) {
    const nextLayer = (artworkLayer + 1) % 2;
    const image = artworkLayers[nextLayer];
    image.removeAttribute("src");
    image.classList.remove("is-visible");
    const fallback = fallbackArtwork[next.index % fallbackArtwork.length];
    const artworkUrl = next.track.artwork || fallback;
    image.onload = () => {
      image.classList.add("is-visible");
      artworkLayers[artworkLayer].classList.remove("is-visible");
      artworkLayer = nextLayer;
    };
    image.onerror = () => {
      image.onerror = null;
      image.src = fallback;
    };
    image.src = artworkUrl;
  }

  function prepareDeck(deck, next) {
    const url = new URL(next.track.url, window.location.href).href;
    if (deck.src !== url) {
      deck.src = next.track.url;
      deck.load();
    }
    return new Promise((resolve) => {
      if (deck.readyState >= 1) { resolve(); return; }
      deck.addEventListener("loadedmetadata", resolve, { once: true });
      deck.addEventListener("error", resolve, { once: true });
    });
  }

  async function crossfade(next, shouldPlay) {
    const id = ++transitionId;
    const outgoing = activeAudio();
    const incomingIndex = (activeDeck + 1) % 2;
    const incoming = decks[incomingIndex];
    await prepareDeck(incoming, next);
    if (id !== transitionId) return;
    incoming.currentTime = next.position;
    incoming.volume = shouldPlay || !outgoing.paused ? 0 : Number(volume.value);
    if (shouldPlay || !outgoing.paused) {
      try { await incoming.play(); } catch (error) { return; }
      const started = performance.now();
      const fade = (timestamp) => {
        const progress = Math.min(1, (timestamp - started) / 2500);
        incoming.volume = Number(volume.value) * progress;
        outgoing.volume = Number(volume.value) * (1 - progress);
        if (progress < 1) requestAnimationFrame(fade);
        else {
          outgoing.pause();
          outgoing.removeAttribute("src");
          outgoing.load();
          preloadedTrackId = "";
          preloadUpcoming(next);
        }
      };
      requestAnimationFrame(fade);
    }
    activeDeck = incomingIndex;
    if (!(shouldPlay || !outgoing.paused)) {
      preloadedTrackId = "";
      preloadUpcoming(next);
    }
  }

  function setTrack(next, shouldPlay = false) {
    if (!next) {
      station = null;
      title.textContent = "Ty deBruyn Radio";
      artist.textContent = "Add tracks to radio/playlist.js";
      status.textContent = "The station is not configured with any music yet.";
      startOverlay.classList.add("is-hidden");
      player.classList.remove("is-playing");
      return;
    }
    if (station && station.index === next.index && activeAudio().src) return;
    const changingTrack = Boolean(station);
    station = next;
    preloadUpcoming(next);
    trackInfo.classList.remove("is-transitioning");
    void trackInfo.offsetWidth;
    trackInfo.classList.add("is-transitioning");
    status.textContent = "";
    title.textContent = next.track.title || "Untitled track";
    artist.textContent = next.track.artist || "Ty deBruyn Radio";
    setArtwork(next);
    if (changingTrack) crossfade(next, shouldPlay);
    else {
      activeAudio().src = next.track.url;
      activeAudio().load();
    }
  }

  function expectedPosition() {
    if (!station) return 0;
    const current = stateAt();
    return current && current.index === station.index ? current.position : 0;
  }

  async function startAudio() {
    const audio = activeAudio();
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
    const changingTrack = Boolean(station && next && station.index !== next.index);
    setTrack(next, shouldPlay);
    if (!next) return;
    if (changingTrack) return;
    const audio = activeAudio();
    const position = next.position;
    const correct = () => { if (Math.abs((audio.currentTime || 0) - position) > 1.5) audio.currentTime = position; };
    if (audio.readyState >= 1) correct();
    else audio.addEventListener("loadedmetadata", correct, { once: true });
    if (shouldPlay || (!audio.paused && audio.readyState < 3)) startAudio();
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
    decks.forEach((deck) => { deck.volume = Number(volume.value); });
    try { localStorage.setItem("tydebruyn-radio-volume", volume.value); } catch (error) { /* optional preference */ }
    revealVolume();
  });
  startOverlay.addEventListener("click", startAudio);
  decks.forEach((deck) => {
    deck.addEventListener("playing", () => player.classList.add("is-playing"));
    deck.addEventListener("pause", () => { if (deck === activeAudio()) player.classList.remove("is-playing"); });
    deck.addEventListener("error", () => { if (deck === activeAudio()) status.textContent = "Audio could not be loaded."; });
  });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) synchronize(!activeAudio().paused); });
  setInterval(() => {
    const next = stateAt();
    if (!next) return;
    preloadUpcoming(next);
    if (!station || station.index !== next.index) synchronize(!activeAudio().paused);
    fill.style.width = `${Math.min(100, Math.max(0, next.position / next.track.duration * 100))}%`;
    if (!activeAudio().paused && activeAudio().readyState >= 3 && Math.abs(activeAudio().currentTime - next.position) > 4) {
      activeAudio().currentTime = next.position;
    }
  }, 250);

  synchronize(true);
  setInterval(() => synchronize(false), 30000);
})();
