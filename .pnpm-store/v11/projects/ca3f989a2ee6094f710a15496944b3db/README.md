# Vignette render server

This Express service renders the script returned by the web app, chooses one
file from `public/music/` at random, uploads the final MP4 to Cloudinary, and
returns its secure URL.

## Local setup

1. Copy the three Cloudinary variables into `render-server/.env`.
2. Run `pnpm install` and `pnpm dev` from this folder.
3. Set `NEXT_PUBLIC_RENDER_API_URL=http://localhost:4000` in `web/.env.local`.

`POST /api/render` accepts:

```json
{ "imageUrls": ["https://..."], "script": { "version": "1", "totalDurationSeconds": 10, "scenes": [] } }
```

It returns `{ "status": "completed", "videoUrl": "https://..." }` after a
synchronous render. A future queue can retain the route and replace the
response with `{ "jobId": "..." }`.

## Render deployment

Deploy this folder as the Render service root. Add the Cloudinary values and
set `WEB_ORIGIN` to the Vercel site URL. In Vercel, set
`NEXT_PUBLIC_RENDER_API_URL` to the Render service URL. Do not put Cloudinary
secrets in the Next.js public environment.
