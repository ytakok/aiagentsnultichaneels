# Agent Hub

Multi-tenant message workspace. The current build includes the Angular dashboard, NestJS API, shared channel contracts, Firebase Auth/Firestore emulators, demo tenant seeding, and the read-only Gmail connector. No real Firebase project is required for local development.

## Requirements

- Node.js 22.12 or newer
- npm 10 or newer
- Java 21 or newer for the Firestore emulator

## Local Setup

```powershell
npm ci
Copy-Item .env.example .env
npm run dev
```

`npm run dev` starts the Auth and Firestore emulators, waits for both, seeds the demo account and tenant, then serves the API and dashboard.

- Dashboard: `http://localhost:4200`
- API: `http://localhost:3000/api/v1`
- Firebase Emulator UI: `http://localhost:4000`
- Auth emulator: `http://localhost:9099`
- Firestore emulator: `http://localhost:8080`

Sign in with `inteliaiconsultancy@gmail.com` / `Yossi8289`. Successful sign-in opens the empty inbox. The Auth user has the `tenantId: demo` custom claim and an owner record under `tenants/demo/members/{uid}`.

To run the pieces independently, use separate terminals:

```powershell
npm run start:emulators
npm run seed
npm run api:dev
npm run dashboard:dev
```

The seed command expects the emulators to be running. Emulator state is local and can be reset by stopping and restarting the emulators.

## Environment

`.env.example` lists local Firebase emulator endpoints, Gmail OAuth settings, and the optional `ANTHROPIC_API_KEY` for later classification work. `npm run dev` loads `.env` when present. Never put real credentials in source control; `.env` and the local `.local/` token directory are ignored.

AngularFire connects to the local Auth and Firestore emulators. The API uses `firebase-admin` and the emulator host variables. Firestore rules allow authenticated reads only when the token's `tenantId` matches the tenant path and deny all client writes; API writes use the Admin SDK.

## Checks

```powershell
npm run build
npm test
npm run lint
```

## Gmail OAuth

1. In Google Cloud, enable the Gmail API, configure the OAuth consent screen, add `inteliaiconsultancy@gmail.com` as a test user if the app is in testing mode, and create an OAuth client ID of type **Desktop app**.
2. Copy the client ID and client secret from the downloaded client JSON into `GMAIL_CLIENT_ID` and `GMAIL_CLIENT_SECRET` in `.env`. Keep the default callback as `http://localhost:3000/api/v1/channels/gmail/oauth/callback`, or set `GMAIL_REDIRECT_URI` consistently with your local OAuth client setup.
3. Start the stack with `npm run dev`, sign in to the Firebase emulator, open **Channels**, and choose **Connect Gmail**. The Google account must match the Agent Hub sign-in email. Complete Google's consent screen in the browser.

The integration requests only `https://www.googleapis.com/auth/gmail.readonly`. Refresh tokens are stored locally in `.local/gmail-tokens.json`, ignored by Git. The API polls Gmail history every 60 seconds and stores normalized inbound messages under the authenticated tenant; the dashboard inbox refreshes its view every five seconds. Firebase continues to use the emulators. AI classification and automation are not included in this direct Gmail milestone jump.
