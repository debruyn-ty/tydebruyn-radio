(() => {
  const audio = document.querySelector("#audio");
  const record = document.querySelector("#record");
  const artwork = document.querySelector("#artwork");
  const title = document.querySelector("#track-title");
  const artist = document.querySelector("#artist");
  const fill = document.querySelector("#progress-fill");
  const status = document.querySelector("#status");
  const listen = document.querySelector("#listen-button");
  const controls = document.querySelector(".controls");
  const volumeButton = document.querySelector("#volume-button");
  const volume = document.querySelector("#volume");
  const api = "../api/radio-state.php";
  let station = null;
  let serverOffset = 0;
  let volumeTimer = 0;

  let storedVolume = NaN;
  try { storedVolume = Number.parseFloat(localStorage.getItem("tydebruyn-radio-volume")); } catch (error) { /* local storage can be disabled */ }
  if (Number.isFinite(storedVolume)) volume.value = String(Math.max(0, Math.min(1, storedVolume)));
  audio.volume = Number(volume.value);

  function now() { return Date.now() + serverOffset; }
  function expectedPosition() {
    if (!station) return 0;
    return Math.max(0, (now() - station.trackStartAt) / 1000);
  }
  function setTrack(next) {
    if (!next.track) {
      station = null;
      title.textContent = "Ty deBruyn Radio";
      artist.textContent = next.message || "Add MP3 files to start the station.";
      status.textContent = "";
      listen.hidden = true;
      record.parentElement.classList.remove("playing");
      return;
    }
    if (station && station.track.id === next.track.id && audio.src) return;
    station = next;
    title.textContent = next.track.title || "Untitled track";
    artist.textContent = next.track.artist || "Ty deBruyn Radio";
    artwork.removeAttribute("src");
    if (next.track.artwork) {
      artwork.onload = () => { artwork.style.opacity = ".82"; };
      artwork.src = next.track.artwork;
    }
    audio.src = next.track.url;
    audio.load();
  }
  async function sync(shouldPlay = false) {
    try {
      const requestStarted = Date.now();
      const response = await fetch(`${api}?_=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Station returned ${response.status}`);
      const data = await response.json();
      serverOffset = data.serverTime - (requestStarted + (Date.now() - requestStarted) / 2);
      setTrack(data);
      const position = expectedPosition();
      if (Number.isFinite(position) && Math.abs((audio.currentTime || 0) - position) > 1.5) {
        const seek = () => { if (Number.isFinite(position)) audio.currentTime = position; };
        if (audio.readyState >= 1) seek(); else audio.addEventListener("loadedmetadata", seek, { once: true });
      }
      if (shouldPlay || !audio.paused) startAudio();
      status.textContent = "";
    } catch (error) {
      status.textContent = "Unable to reach the station. Retrying…";
      if (!station) title.textContent = "Radio unavailable";
    }
  }
  async function startAudio() {
    try {
      await audio.play();
      record.parentElement.classList.add("playing");
      listen.hidden = true;
      status.textContent = "";
    } catch (error) {
      listen.hidden = false;
      status.textContent = "Playback is waiting for your interaction.";
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
  volume.addEventListener("input", () => {
    audio.volume = Number(volume.value);
    try { localStorage.setItem("tydebruyn-radio-volume", volume.value); } catch (error) { /* preference remains local */ }
    revealVolume();
  });
  listen.addEventListener("click", () => { sync(true); });
  audio.addEventListener("play", () => record.parentElement.classList.add("playing"));
  audio.addEventListener("pause", () => record.parentElement.classList.remove("playing"));
  audio.addEventListener("error", () => { status.textContent = "This track could not be loaded. Rejoining the station…"; setTimeout(() => sync(true), 3000); });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) sync(!audio.paused); });
  setInterval(() => {
    if (!station) return;
    const duration = station.track.duration;
    fill.style.width = `${Math.min(100, Math.max(0, expectedPosition() / duration * 100))}%`;
    if (expectedPosition() >= duration + 1) sync(!audio.paused);
  }, 250);
  sync();
  setInterval(() => sync(false), 20000);
})();
