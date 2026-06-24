# Karteikasten — PWA

German vocabulary flashcard app. Spaced repetition (Leitner boxes 1–5), two user profiles, 350+ A1–B1 words, Artikel training, B1 verb+preposition cards.

## Quickstart

```bash
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

## Build & preview (production)

```bash
npm run build
npm run preview
```

Open http://localhost:4173 — this is the PWA build. On desktop Chrome you can install it via the address bar. On iPhone, open in **Safari** → Share → Add to Home Screen.

## Deploy to Vercel (recommended)

1. Push this folder to a GitHub repo
2. Go to [vercel.com](https://vercel.com) → Add New Project → import your repo
3. Vercel auto-detects Vite — just click **Deploy**
4. Your app is live at `https://karteikasten.vercel.app` (or similar)

## Install on iPhone

1. Open the Vercel URL in **Safari** on iPhone
2. Tap the **Share** button (box with arrow)
3. Tap **"Add to Home Screen"**
4. Name it "Karteikasten" → tap **Add**
5. The icon appears on your home screen — tap it for a fullscreen, native-feeling app

## Storage

All data is stored in `localStorage` on each device. Progress is local and separate per device. If you want cross-device sync in the future, Supabase (free tier) is the cleanest upgrade.

### Storage keys used

| Key | Contents |
|---|---|
| `karteikasten-words` | Shared word list |
| `karteikasten-profiles` | User profiles |
| `karteikasten-active-profile` | Currently selected profile |
| `karteikasten-progress-{userId}` | Per-user card progress |
| `karteikasten-history-{userId}` | Per-user session history |
| `karteikasten-settings` | Direction mode setting |
| Various `karteikasten-*-done` keys | One-time migration flags |

## Icons

Icons are in `/public`. To regenerate them with a new design, run:

```bash
pip install Pillow
python3 generate-icons.py
```

Or replace the PNG files manually with your own (192×192, 512×512, 180×180 apple-touch-icon).
