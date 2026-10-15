# Ground floor lighting demo

A realistic 3D cutaway floor-plan visualization plus a small Node.js server. The render asset is `ground-floor-render.png`. The isometric cutaway starts in a dim, desaturated state with object detail preserved; switching on a room reveals the bright render and warm light spill. Click a room card or the illustrated lamp to manually switch a light; accepted agent commands also update all open views live.

## Run locally

Requires Node.js 18 or newer. From this folder:

```sh
node server.mjs
```

Open `http://localhost:3000`. To secure the command endpoint while developing, start it with `COMMAND_TOKEN` set, then send the same secret as a Bearer token. Before exposing it online, set a strong secret and deploy behind HTTPS.

## Send commands

```sh
curl -X POST http://localhost:3000/command \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer your-secret' \
  -d '{"command":"livingroomlighton"}'
```

The bearer header is optional when `COMMAND_TOKEN` is unset (local demo mode) and required when it is set. Valid commands:

- `livingroomlighton` / `livingroomlightoff`
- `kitchenlighton` / `kitchenlightoff`
- `bathroomlighton` / `bathroomlightoff`
- `ovenpreheaton` / `ovenpreheatoff` (demo preheat indicator only)

Manual switches in the page change the local view immediately. The server broadcasts accepted agent commands over Server-Sent Events to all open floor-plan pages. It keeps state in memory only, so each server restart starts with all lights and the oven off. Oven commands update only the demo's visual preheat indicator; they do not control a physical oven. For a durable public deployment, add state persistence and configure the Zendesk agent's server-side action to call this HTTPS endpoint; keep the token out of browser code.
