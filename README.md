# Ty deBruyn Radio

Framework-free, mobile-first web radio with a PHP-controlled shared timeline. The browser has a local `HTMLAudioElement`, but track selection and position are derived from `api/radio-state.php`, so pausing or changing volume affects only that listener.

## Free option: GitHub Pages

You do **not** need to buy anything under Namecheap **Hosting List** if you only want to use your already-registered domain.

GitHub Pages is free and can host the HTML, CSS, JavaScript, artwork, and MP3 files. However, GitHub Pages cannot run PHP. Publishing this current project directly with GitHub Pages would make the player UI load but would break the shared radio API and true synchronized playback.

There are therefore two choices:

1. **Free GitHub Pages version:** static website, with no PHP backend. This is suitable for a personal player but cannot guarantee that every visitor hears the same track and position.
2. **Full synchronized radio:** requires a PHP-capable host such as Namecheap hosting, or a separate free backend service such as Cloudflare Workers/Firebase. This preserves the shared timeline.

Do not purchase Namecheap hosting unless you specifically want the full PHP version. The domain can remain registered at Namecheap while the website is hosted elsewhere.

### Publish the current static files on GitHub Pages

1. Create a GitHub repository, for example `$env:Path += ";C:\Program Files\Git\cmd"
git --version`.
2. Push this project using the Git commands below.
3. In GitHub, open **Settings → Pages**.
4. Under **Build and deployment**, select **Deploy from a branch**, choose `main`, choose `/ (root)`, and save.
5. GitHub will provide a temporary address such as `https://YOUR-USERNAME.github.io/tydebruyn-radio/`.

The current PHP player API will not work at that address. The frontend must first be converted to a static playlist/timeline implementation, and MP3 files must comply with GitHub's file-size limits. I can make that conversion, but it intentionally gives up authoritative cross-visitor synchronization.

### Connect `tydebruyn.me` to GitHub Pages

In the repository, add a file named `CNAME` containing exactly:

```text
tydebruyn.me
```

In Namecheap, open **Domain List → Manage → Advanced DNS**—not **Hosting List**—and add:

- `A` records for `@` pointing to GitHub Pages' current IPv4 addresses shown in GitHub's Pages documentation.
- A `CNAME` record for `www` pointing to `YOUR-USERNAME.github.io`.

Then return to GitHub **Settings → Pages**, enter `tydebruyn.me` as the custom domain, and enable HTTPS after DNS finishes propagating. DNS changes may take several hours.

## Full synchronized deployment with paid hosting

Use GitHub as the free source-code repository and Namecheap shared hosting as the web server. This is only needed for the PHP-controlled shared timeline. Namecheap DNS can point `tydebruyn.me` to that hosting account.

The root `index.html` redirects `https://tydebruyn.me/` to `https://tydebruyn.me/radio/`.

## Structure

- `radio/` — the public player.
- `api/` — read-only JSON endpoints.
- `audio/` — upload approved `.mp3` files here.
- `scripts/metadata.php` — validates files and extracts basic ID3 metadata.
- `private/` — writable state/cache directory; deny public access.

## Namecheap deployment

1. In Namecheap, open **Hosting List → Manage → cPanel** and confirm the account has PHP 8.0 or newer. Enable HTTPS with the available SSL option.
2. In cPanel, open **File Manager → public_html**. Upload the project contents so these paths exist:
   - `public_html/index.html`
   - `public_html/radio/index.html`
   - `public_html/api/radio-state.php`
   - `public_html/audio/`
3. Upload MP3 files into `public_html/audio/`. Keep filenames simple (letters, numbers, spaces, hyphens, and underscores).
4. Make `public_html/private/` writable by the PHP process, usually permission `750` or `755`, but never make it world-readable. The included `.htaccess` denies web access.
5. For stronger isolation, create a directory outside `public_html` (for example the cPanel account home directory), move `private/` there, and change `RADIO_PRIVATE_DIR` in `api/config.php` to its absolute server path.
6. In cPanel **MultiPHP Manager**, select PHP 8.0+ for the domain. The application uses standard PHP filesystem functions and does not need a database.
7. Visit `https://tydebruyn.me/radio/` and click **Tap to listen**. The first API request creates the shared state and artwork cache.

### Namecheap DNS

If the domain and hosting are in the same Namecheap account, use **Domain List → Manage → Advanced DNS** and follow the hosting account's cPanel connection instructions. Typically the domain uses the Namecheap hosting nameservers, or an `A` record points at the hosting server IP. Do not add GitHub Pages `A` records for this PHP deployment. DNS and SSL changes can take several hours to propagate.

### GitHub repository

Create a private or public repository on GitHub, then from this folder run:

```text
git init
git add .
git commit -m "Initial Ty deBruyn Radio"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/tydebruyn-radio.git
git push -u origin main
```

Do not commit MP3 files, generated artwork, or private state. The included `.gitignore` excludes them. Use cPanel/File Manager or SFTP to upload those production-only files.

## Local verification

Use PHP 8.0+ with `fileinfo`/standard filesystem functions enabled and Apache (or an equivalent web server). Upload this directory so `/radio/` contains `radio/index.html`; keep `private/` outside the public document root in production by changing `RADIO_PRIVATE_DIR` in `api/config.php` to an absolute writable directory. Ensure `audio/` and `radio/assets/artwork/` are readable, and `private/` is writable by PHP.

Place MP3 files in `audio/`. The first request to `api/radio-state.php` indexes valid files. The index is deterministic for the current collection and is shuffled once into a persistent state file. Adding/removing files creates a new sequence; existing state is not changed by any visitor action.

The current implementation reads ID3v2 text tags and extracts the first embedded APIC image into the artwork cache. Duration uses a conservative MP3 bitrate fallback; for accurate VBR timing, run an indexing step with `ffprobe` in production and store the resulting duration in the metadata cache, or replace `parse_mp3()` with the host's approved ID3 parser. No audio files or filesystem paths are exposed by the API.

## Testing

Run `php -l api/config.php`, `php -l api/radio-state.php`, `php -l api/radio-config.php`, and `php -l scripts/metadata.php`. Start a local PHP server with `php -S localhost:8080` from the project root, open `http://localhost:8080/radio/` in two browser windows, and compare the displayed track and progress after starting playback in each. Browser autoplay policies require a click in each window.

With no MP3s, the player remains usable and the API returns a clear empty-station response. Production validation still requires real MP3s, correct web-server permissions, and testing on the target hosting provider.
