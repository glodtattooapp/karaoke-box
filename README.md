# Ferris Müller Karaoke Box 🎤

A free, no-build karaoke night website — search a song library, queue things up, and it streams in a retro-styled media player with real play/pause/seek controls. Get a score, sign the guestbook, and print out a decorated photo strip from your webcam.

**Every file in this folder is flat — no subfolders.** That's intentional: it's built this way specifically so uploading to GitHub can't go wrong by dropping a folder in the wrong place.

## Put it on GitHub (free hosting)
1. On your repo page, click **Add file → Upload files**.
2. Select **everything in this folder** (all the .html/.css/.js/.jpg/.png/.gif files) and drop them all in at once.
3. Commit.
4. Go to **Settings → Pages**, set Source to **Deploy from a branch**, branch `main`, folder `/ (root)`, and save.
5. Give it a minute, then visit your `https://yourusername.github.io/reponame/` URL.

That's it — since nothing lives in a subfolder, there's no folder-structure step to get wrong.

## Run it locally
Open `index.html` in a browser. No install, no build step.

Two things need `https://` (or `localhost`) to work: the webcam-based photo booth, and (in most browsers) the YouTube player. They won't work if you just double-click `index.html` from your desktop — but everything visual (logo, background, garlands, frames) will.

## What's in it
- **Top & bottom garlands** — `sakura-flower.gif` chains across the top of the page, `flower-chain.gif` sits behind the bottom bar
- **Custom logo** (`logo-title.png`) — your glitter title graphic, background removed with a clean edge
- **Background** (`bg-pink-desktop.jpg`) — your pink desktop screenshot
- **YouTube streaming** — paste a link + title + singer, it queues, and plays through a real retro media-player skin: working play/pause, ±10s skip, click-to-seek scrubber with a live timestamp, volume slider, and a "skip to next" button. Auto-advances to the score screen when the video ends.
- **Song library search** — empty on purpose, wired up for your folder of local song files (see below)
- **Photo booth** — live webcam capture, 3-shot countdown, vintage sepia filter, and:
  - Four textured frames: pink leopard print, rose-gold glitter leopard, sunset palms, rainbow dolphins
  - Real sticker images (`sticker-*.png`) — click one to drop it onto the strip, drag it anywhere, as many as you like, double-click to remove one
  - No text on the strip — just your photos, your stickers, your frame
  - "Save strip to computer" exports everything into one real .jpg
- **Guestbook** — reaction emoji stamps, saved in the browser via localStorage
- Confetti burst on every finished song, bonus "Encore!!" flash on a 90+ score

## Wiring up your song folder (next step)
Open `script.js` and find:
```js
const LOCAL_SONGS = [];
```
Once you have your files, populate this array, e.g.:
```js
const LOCAL_SONGS = [
  { title: "Song Name", artist: "Artist", url: "song-name.mp4" },
];
```
Drop the actual video files in this same folder (flat, like everything else) and upload them alongside the rest. If a song is YouTube-hosted instead, use a YouTube URL for `url` and it goes through the same player.

## Ideas for next passes
- Once songs are local video files, swap the YouTube player for a plain `<video>` tag so it can play them directly
- Add a resize handle on placed stickers (currently fixed size)
- Add real mic input volume as the scoring input instead of random
