(() => {
  const audio = document.querySelector("#audio");
  const record = document.querySelector("#record");
  const artwork = document.querySelector("#artwork");
  const title = document.querySelector("#track-title");
  const artist = document.querySelector("#artist");
  const fill = document.querySelector("#progress-fill");
  const status = document.querySelector("#status");
  const controls = document.querySelector(".controls");
  const volumeButton = document.querySelector("#volume-button");
  const volume = document.querySelector("#volume");
  const player = document.querySelector(".player");
  let station = null;
  let volumeTimer = 0;

  let storedVolume = NaN;
  try { storedVolume = Number.parseFloat(localStorage.getItem("tydebruyn-radio-volume")); } catch (error) { /* optional preference */ }
  if (Number.isFinite(storedVolume)) volume.value = String(Math.max(0, Math.min(1, storedVolume)));
  audio.volume = Number(volume.value);

  function stateAt(time = Date.now()) {
    const playlist = window.RADIO_PLAYLIST || [];
    if (!playlist.length) return null;
    const total = playlist.reduce((sum, track) => sum + track.duration, 0);
    if (!total) return null;
    const elapsed = ((time - window.RADIO_EPOCH_MS) / 1000 % total + total) % total;
    let cursor = 0;
    for (let index = 0; index < playlist.length; index += 1) {
      const track = playlist[index];
      if (elapsed < cursor + track.duration) {
        return { track, index, position: elapsed - cursor };
      }
      cursor += track.duration;
    }
    return { track: playlist[0], index: 0, position: 0 };
  }

  function setTrack(next) {
    if (!next) {
      station = null;
      title.textContent = "Ty deBruyn Radio";
      artist.textContent = "Add tracks to radio/playlist.js";
      status.textContent = "The station is not configured with any music yet.";
      player.classList.remove("is-playing");
      return;
    }
    if (station && station.index === next.index && audio.src) return;
    station = next;
    status.textContent = "";
    title.textContent = next.track.title || "Untitled track";
    artist.textContent = next.track.artist || "Ty deBruyn Radio";
    artwork.removeAttribute("src");
    artwork.style.opacity = next.track.artwork ? ".82" : "0";
    if (next.track.artwork) artwork.src = next.track.artwork;
    audio.src = next.track.url;
    audio.load();
  }

  function expectedPosition() {
    if (!station) return 0;
    const current = stateAt();
    return current && current.index === station.index ? current.position : 0;
  }

  async function startAudio() {
    try {
      audio.currentTime = expectedPosition();
      await audio.play();
      player.classList.add("is-playing");
      status.textContent = "";
    } catch (error) {
      status.textContent = "Playback is blocked until the browser allows audio.";
    }
  }

  function synchronize(shouldPlay = false) {
    const next = stateAt();
    setTrack(next);
    if (!next) return;
    const position = next.position;
    const correct = () => {
      if (Math.abs((audio.currentTime || 0) - position) > 1.5) audio.currentTime = position;
    };
    if (audio.readyState >= 1) correct();
    else audio.addEventListener("loadedmetadata", correct, { once: true });
    if (shouldPlay || !audio.paused) startAudio();
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
  volumeButton.addEventListener("pointerdown", () => startAudio());
  volume.addEventListener("pointerdown", () => {
    revealVolume();
    startAudio();
  });
  volume.addEventListener("input", () => {
    audio.volume = Number(volume.value);
    try { localStorage.setItem("tydebruyn-radio-volume", volume.value); } catch (error) { /* optional preference */ }
    revealVolume();
  });
  audio.addEventListener("play", () => player.classList.add("is-playing"));
  audio.addEventListener("pause", () => {
    player.classList.remove("is-playing");
    if (station) setTimeout(() => startAudio(), 250);
  });
  audio.addEventListener("error", () => {
    player.classList.remove("is-playing");
    status.textContent = "Audio could not be loaded. Check the MP3 file in the repository.";
  });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) synchronize(!audio.paused); });
  setInterval(() => {
    const next = stateAt();
    if (!next) return;
    if (!station || station.index !== next.index) synchronize(!audio.paused);
    fill.style.width = `${Math.min(100, Math.max(0, next.position / next.track.duration * 100))}%`;
    if (!audio.paused && Math.abs(audio.currentTime - next.position) > 2) audio.currentTime = next.position;
  }, 250);

  synchronize(true);
  setInterval(() => synchronize(true), 30000);
})();
