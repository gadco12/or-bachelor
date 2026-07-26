# Or's Bachelor — Boarding Pass Invite

A single-file web app styled like an airline boarding pass. Guests pick their
name, RSVP, and (if they're coming) get a personalized TLV → Athens ticket with
a link to the WhatsApp group.

## Run / debug locally
Just open `index.html` in any browser (double-click it, or drag it into a
browser tab). No server, no build step — it's one self-contained file.

## Edit
Everything you'd want to change lives in the `CONFIG` object near the top of the
`<script>` block at the bottom of `index.html`:

- `names` — the dropdown list of guests
- `whatsapp` — the group invite link (shown only on the final ticket)
- `orPhoto` — Or's photo for the "Or is the king" screen (embedded as a data URI)

Flight details (route, dates, times, flight number), the ticket wording, and the
three RSVP options are in the HTML markup above the script.

## The flow
1. Pick your name.
2. Choose one of three:
   - **I'm coming to celebrate** → thank-you → your boarding pass (with WhatsApp link).
   - **I'm not coming (and I'm gay)** → "It's ok, but Or will never speak to you again."
   - **Or is the king** → Or's photo pops up → sends you back to choose again.
3. Screenshot the ticket and send it to the group.

## Share it with friends
A local file only opens on your own computer. To give the group a link, host the
folder (e.g. GitHub Pages) so `index.html` becomes a public URL.
