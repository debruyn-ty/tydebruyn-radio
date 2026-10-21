# Ty deBruyn Radio

Minimal, framework-free web radio designed for free GitHub Pages hosting. It uses a shared deterministic clock instead of PHP: every browser calculates the current track from the same UTC epoch, playlist order, and track durations.

## How synchronization works

`radio/playlist.js` contains one shared `RADIO_EPOCH_MS` and the ordered playlist. Each browser calculates:

```text
elapsed = (current UTC time - epoch) modulo total playlist duration
```

It then selects the corresponding track and seeks to the corresponding offset. A visitor joining late therefore joins the same scheduled track rather than starting at the beginning.

This is close synchronization, not a broadcast stream. Differences in device clocks, buffering, network speed, and audio decoding can create small offsets. The player corrects drift periodically. Local pauses affect only that visitor.

The player estimates the hosting server's clock from the `Date` response header so devices with different system clocks select the same track. Track changes use the next deck's preloaded audio and preserve each MP3's own fade-out instead of applying a second audio gain ramp; the visual artwork transition remains gradual.

## Add music

Drop an MP3 into [mp3s/](mp3s/), then commit and push it:

```powershell
Copy-Item "C:\path\to\new-song.mp3" "mp3s\"
git add mp3s
git commit -m "Add new track"
git push
```

The GitHub Actions workflow automatically reads the MP3's ID3 metadata, including title, artist, duration, and embedded cover art. It regenerates [radio/playlist.js](radio/playlist.js) and commits the generated artwork. GitHub Pages then publishes the updated station. Do not edit `radio/playlist.js` manually.

For local generation, install the metadata reader once and run:

```powershell
python -m pip install mutagen
python scripts\generate_playlist.py
```

If a track has no artwork, the player uses its neutral vinyl fallback. GitHub has file-size limits, so use short compressed MP3s or host larger audio files from a suitable static asset host.

Change the epoch only when you intentionally want to restart the shared schedule. Keep the same epoch and playlist on all visitors. Adding or removing tracks changes the schedule for everyone; the workflow preserves the existing epoch.

## GitHub Pages deployment

GitHub Pages is free and does not require Namecheap Hosting. Namecheap is only used for the domain and DNS.

1. Push the project to GitHub.
2. Open the repository's **Settings → Pages**.
3. Select **Deploy from a branch**, branch `main`, folder `/ (root)`, then save.
4. Add a repository-root file named `CNAME` containing:

```text
tydebruyn.me
```

5. In Namecheap, open **Domain List → Manage → Advanced DNS**, not **Hosting List**.
6. Add the GitHub Pages DNS records shown in GitHub's custom-domain instructions. Commonly this is a `CNAME` for `www` pointing to `debruyn-ty.github.io` and GitHub Pages `A` records for the root `@` domain.
7. Return to **Settings → Pages**, enter `tydebruyn.me` as the custom domain, and enable HTTPS after DNS propagates.

DNS changes can take several hours.

## Files

- `radio/index.html` — player markup.
- `radio/styles.css` — responsive visual design.
- `radio/app.js` — audio playback and synchronization.
- `radio/playlist.js` — generated shared epoch and track list.
- `mp3s/` — MP3 storage; add tracks here.
- `scripts/generate_playlist.py` — ID3 metadata and artwork generator.
- `.github/workflows/generate-playlist.yml` — automatic metadata generation on push.
- `radio/assets/artwork/` — generated artwork storage.

The old `api/`, `scripts/metadata.php`, and `private/` files are retained as optional PHP deployment references, but GitHub Pages does not execute them and the static player does not request them.

## Test locally

From the project root, start any static server. If Python is installed:

```powershell
python -m http.server 8080
```

Open `http://localhost:8080/radio/` in two browser windows, click **Tap to listen** in each, and verify that both show the same track and progress. Do not open the HTML with a `file://` URL because browsers restrict local module/assets behavior.
