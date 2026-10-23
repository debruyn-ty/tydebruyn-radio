# Ty deBruyn Radio

Minimal, framework-free web radio designed for free GitHub Pages hosting. Each listener starts at a random track position, then playback continues locally through the playlist.

## How playback works

The player chooses a random track and random starting position when the page loads. After the listener starts playback, tracks continue sequentially on that device. The skip button advances to the next track and disables no shared schedule because there is no live schedule. Track changes preserve each MP3's own fade-out; artwork transitions remain gradual.

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
- `radio/app.js` — local random audio playback.
- `radio/playlist.js` — generated track list.
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

Open `http://localhost:8080/radio/`, click **Tap to listen**, and verify that a random track starts at a non-zero position. Do not open the HTML with a `file://` URL because browsers restrict local asset behavior.
