# Champagne Ori — Bachelor Boarding Pass 🦉

An EL AL–styled boarding-pass invite (For All The Dogs edition). Guests pick
their name, RSVP, and — if they're coming — get a personalized TLV → Athens
ticket they can send straight to the WhatsApp group. Every RSVP is recorded so
the host sees who's in.

## Run locally (just the look)
Open `index.html` in a browser. The RSVP recording and one-tap WhatsApp share
only work once it's **hosted** (they need HTTPS), so for the full thing, deploy.

## What's here
- `index.html` — the whole invite (self-contained: styles, script, Or's photo)
- `server.js` — Node/Express backend: serves the invite, records RSVPs, host dashboard
- `render.yaml` — one-click Render blueprint (web service + free Postgres)
- `package.json` — dependencies (express, pg)

## Edit the invite
Everything tweakable is in the `CONFIG` object near the top of the `<script>` in
`index.html`:
- `names` — the guest dropdown
- `whatsapp` — the group invite link (shown only on the final ticket)
- `orPhoto` — Or's photo (embedded data URI)
- `logEndpoint` — `"/rsvp"` (the backend); leave empty to disable recording

## Deploy (free) — makes RSVP recording + WhatsApp share work
1. Push this repo to GitHub.
2. On [render.com](https://render.com): **New + → Blueprint** → pick this repo.
3. When prompted, set **HOST_KEY** to any password you choose.
4. **Apply.** Render builds the site and a free Postgres database automatically.
5. Your invite is live at `https://<your-app>.onrender.com` — send that to the group.

## Host dashboard
Open `https://<your-app>.onrender.com/host?key=YOUR_HOST_KEY`
Live tally (coming / not coming / king) + a table of everyone's latest answer,
auto-refreshing. Keep this link private — the key protects it.

## The flow
1. Pick your name.
2. Choose one of three:
   - **I'm coming to celebrate** → your boarding pass (+ WhatsApp share).
   - **I'm not coming (and I'm gay)** → "It's ok, but Or will never speak to you again."
   - **Or is the king** → Or's photo pops up → back to choose again.
3. Tap **Send my ticket to the group** (or screenshot) → post to WhatsApp.

_Note: no website can auto-post to a WhatsApp group (WhatsApp has no such API).
The share button is the closest thing: one tap opens the share sheet, you pick the group, send._
