# Back to the Past — a Samurai Jack fan site

Unofficial, non-commercial fan page. Open `index.html` in a browser, or upload the
whole folder to any static host (GitHub Pages, Netlify, Vercel, Neocities).

## Folder layout

```
index.html              the page
assets/
  css/style.css         all styles; theme colors are the tokens at the top (:root)
  js/main.js            all interactivity (hero reveal, 3D sword, timeline, quiz…)
  js/scenes.js          scroll-driven scenery interludes
  js/stills.js          YOUR screenshots list — edit this to add show stills
  img/jack.webp         hero art (top layer)
  img/aku.png           hero art (revealed layer)
  stills/               put your screenshot files here
  vendor/three.min.js   three.js r128, for the 3D sword (bundled so it works offline)
severed-wind.md         design notes for the petal-wind effect
```

## Adding show screenshots

1. Copy image files into `assets/stills/`.
2. Open `assets/js/stills.js` and list them:
   - `reel`: extra frames for the "Frames from the show" 3D map (every slot still and
     prologue panel already appears there too)
   - `slots`: one picture per character (`jack`, `aku`, `scotsman`, `ashi`, `guardian`,
     `emperor`, `scaramouche`, `x9`, `omen`) or timeline moment (`era-0` … `era-9`)

The site ships with 37 stills (character dossiers, cast tiles, timeline moments,
prologue panels and the reel), taken from the Samurai Jack Wiki at
samuraijack.fandom.com. They belong to Cartoon Network / Adult Swim, so keep the
site non-commercial.

## Scenery interludes

`assets/js/scenes.js` runs four pinned, scroll-driven scenes between sections
(`.vista` blocks in `index.html`): a time-portal tunnel, a pan across the red tree
(`assets/scenery/tree.webp`), the meditation photo (`meditation.webp`) set into a full-screen
grass field painted from the photo's own colors, and a fly-over of the river valley (`valley.jpg`). Swap an
image by replacing the file. Each scene's length is the `height` of its `.vista`
in `style.css`.

When you change CSS or JS, bump the `?v=` number on the three asset links in
`index.html` so browsers fetch the new files instead of cached ones.

Aku's laugh in the Aku section plays `assets/audio/aku-laugh.mp3`. Replace that file to change it.

## Notes

- Fonts load from Google Fonts. Offline, the page falls back to system fonts.
- The upload buttons from the claude.ai version only exist there; in this download,
  stills come from `stills.js`.
- Sound effects play only after you interact with the page (browser rule).
