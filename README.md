# WanderLust

A full-stack travel discovery and demo reservation app built with Node.js, Express 5, EJS, MongoDB/Mongoose, Passport, Cloudinary and Leaflet. The original MVC architecture is preserved.

## Features

- A sourced catalog of 72 real properties across 66 destinations and 13 countries, with official property links.
- Destination/category search, price and capacity filters, date availability, sorting, pagination and saved stays.
- Responsive light/dark layouts, keyboard navigation, reduced-motion support, and lazy maps with safely rendered popups.
- Host listing management, image uploads, reviews, reservation history, printable itineraries and cancellation.
- Transactional inventory checks prevent concurrent overbooking. Check-out and check-in may share a day.
- Immutable property and pricing snapshots preserve receipts after a price change or listing archival.
- Server validation, CSRF protection, password rules, rate limits, secure session configuration and query indexes.

Catalog rates and capacity are indicative demo values; photographs are illustrative and coordinates approximate. Reservations do not book with the named property or collect payments. See [CATALOG_SOURCES.md](CATALOG_SOURCES.md) for all official sources and verification limits.

## Setup

Use the Node.js version declared in `package.json` and MongoDB Atlas or another MongoDB replica set. Replica-set transactions are required for reservations and inventory changes.

```sh
npm install
```

Create a private `.env` using `.env.example` as a template. Configure `ATLASDB_URL`, `SECRET`, and the optional Cloudinary upload credentials. `DB_NAME` overrides the database in the connection URL. Preserve an existing `.env` when upgrading; credentials and existing database records are not part of Git.

```sh
npm start
```

Ordinary development defaults to port 8080. Set `PORT` as needed. `npm run dev` restarts the server when server-side code changes. Cloudinary credentials are required for new host photo uploads; the sourced catalog can be browsed without uploading images.

## Load the demo catalog safely

Use a separate database such as `wanderlust_preview_local`. Set both the URL database and `DB_NAME` to that name, and set `PREVIEW_MODE=true` to isolate the session cookie and default to port 8081.

```sh
npm run catalog:validate
npm run seed
```

Validation is offline. The seed refuses databases outside `wanderlust_preview_<suffix>`, upserts only its own catalog records by stable slug, and never clears existing collections. Repeated runs do not duplicate listings. The curator account is not a real property owner and has no publicly known password. Create an account through Sign up to explore guest or host flows.

Existing databases can use the updated application without running the catalog seed. Existing mixed-case usernames remain usable, older receipt records have a compatibility fallback, and missing map coordinates are repaired on the next listing edit. No automatic destructive database migration is performed.

## Verification

```sh
npm run check
npm test
npm run catalog:validate
```

The checks compile EJS and validate JavaScript syntax. Tests cover dates, input conversion, capacity, pricing, authentication boundaries, CSRF, model constraints and safe map rendering.

```sh
npm run smoke
```

The integration check requires `PREVIEW_MODE=true` and a separate preview database. It creates temporary accounts/listings, exercises concurrent reservations, receipt access, historical pricing, reviews, cancellation and archival, then removes only its own fixtures. It refuses other databases.

## Architecture

- `app.js`: middleware, database-backed sessions, route mounting, error handling and startup.
- `routes/`, `middleware.js`, `controllers/`: endpoints, authorization, validation and request handling.
- `models/`: persistence schemas, relationships and indexes.
- `utils/stays.js`, `utils/bookingService.js`: pricing, interval capacity and transactional reservations.
- `views/`, `public/`: EJS pages, shared components, styles and browser interactions.
- `init/`: catalog provenance, validation and guarded seed/geocoding scripts.

## Deployment

Provide environment variables directly when `NODE_ENV=production`; `.env` is loaded only outside production. Configure a random `SECRET` of at least 32 characters. Respect the hosting provider's `PORT`. Non-preview mode listens on `0.0.0.0`; preview mode listens on `127.0.0.1`, unless `HOST` is explicitly configured.

Production cookies require HTTPS. Set `TRUST_PROXY=1` only when serving behind one trusted reverse proxy that terminates TLS. Set `PREVIEW_MODE=false` for an ordinary deployment. Never commit `.env`, credentials, local logs, or database exports. The bundled catalog and reservation flows remain demonstrations; live property inventory and payment processing are not integrated.
