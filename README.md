# Nikita & Parimal · One Year of Us

A small interactive anniversary keepsake: six full-screen "scenes" (invitation, love story,
scrapbook, timeline, letter, finale). No build step, no dependencies, no paid services.

## Open it
Double-click `index.html`, or serve the folder (`python3 -m http.server`) and visit http://localhost:8000.
To share it, drop the whole folder on Netlify Drop, GitHub Pages, Vercel or Cloudflare Pages.
Google Fonts and the placeholder photos load from the internet; everything else is local.

## Personalise (everything is in `js/config.js`)
| What | Where in config.js |
|---|---|
| Names, wedding date (days counter is live) | `names`, `weddingDate` |
| Wedding photo on the cover + hero arch | `heroPhoto` (put the file in `photos/`, e.g. `photos/wedding.jpg`) |
| Scrapbook photos and captions | `photos` (add/remove lines; local paths work) |
| Timeline milestones | `timeline` (copy a block to add a real moment) |
| The letter | `letter` (salutation, paragraphs, closing, signature) |
| Finale message, fortunes, date-night ideas | `finale`, `fortunes`, `dateIdeas` |
| Music | `song.url` |

**The anniversary keepsake currently uses the 10 uploaded photos in `photos/`.**

## Music
Set `song.url` to a direct audio file (`audio/our-song.mp3`, or any https .mp3/.m4a/.ogg) or a YouTube link.
Spotify links can't play inside a web page. Browsers block autoplay, so music starts when they tap the
music button (bottom-left). The ♪ button next to it lets anyone paste a different link (saved on that device).
Bad or unreachable links show a friendly message instead of failing silently.
YouTube playback needs the site to be served over http(s), not opened from a file.

## Controls
- Scroll / swipe / arrow keys / PageUp-PageDown / Space move between scenes; the dots (top-right on phones) jump to any scene.
- Timeline: click a milestone, use the button, or press ← → .
- Scrapbook: drag photos, tap to open the viewer (← → Esc, or swipe), "+ Add photos" to try your own
  (added photos live in the page only; to keep them, add them to `photos/` and `config.js`).
- Finale: tap the sky for fireworks; Celebrate, fortune, date-night idea, Replay.
- `prefers-reduced-motion` is respected: calm cross-fades, no particles or parallax.

## Files
```
index.html      structure of the six scenes + global UI
css/style.css   tokens, scene engine/transitions, each scene, responsive rules
js/config.js    all personal content
js/main.js      scene engine, input, gallery, lightbox, timeline, letter, music, particles
```
