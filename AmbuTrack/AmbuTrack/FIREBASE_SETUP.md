# Connect AmbuTrack to Firebase

The Firebase integration is implemented, but **no Firebase project is connected in this download**. Until a web configuration is supplied, the banner explicitly says that the app is using local demo storage. No Firebase project, database or cloud resources were created automatically.

## 1. Create or select your project

Open [Firebase Console](https://console.firebase.google.com/), create/select a project, and register a Web app. Copy its `firebaseConfig` object from **Project settings → Your apps → Web app → SDK setup and configuration**.

This is the public web configuration. Do not provide a service-account JSON, private key or account password.

## 2. Enable the required services

- **Authentication → Sign-in method:** enable **Anonymous**.
- **Firestore Database:** create the default database. Choose its location deliberately.
- Publish the contents of the included **firestore.rules** using the Firestore Rules editor. Do not leave the database in open test mode.
- In Authentication settings, add your deployed hostname to Authorized domains. Add `localhost` for local development if needed.

This version intentionally uses isolated anonymous demo accounts. Each browser's authenticated user has a private workspace; it is not a shared multi-dispatcher production system. Clearing site storage or using another browser can create a different anonymous identity. Existing data remains under the old UID. Cross-device access needs permanent sign-in, which is future work.

## 3. Configure the website

Edit `dist/firebase-config.js`:

```js
export const firebaseSettings = {
  enabled: true,
  config: {
    apiKey: 'YOUR_WEB_API_KEY',
    authDomain: 'YOUR_PROJECT.firebaseapp.com',
    projectId: 'YOUR_PROJECT_ID',
    appId: 'YOUR_WEB_APP_ID'
  }
};
```

Use your actual Firebase-generated values, then serve the app or publish the updated `dist` folder. A service-account key never belongs in the frontend. Web config identifies the project; Auth and Firestore security rules enforce access.

For the hosted AmbuTrack site, supply the web config so it can be added to that deployment. The Firebase console setup and rules must also be completed before the connection works.

## 4. Verify the connection

1. Open AmbuTrack. The banner should say **Firebase · connected**.
2. The About page shows the anonymous workspace UID.
3. In Firestore, inspect `users/{uid}/ambutrack/state`.
4. Take a unit offline, then wait for **Firebase · connected** after the saving indicator.
5. Reload: the unit should remain offline.
6. Run a trip for at least five seconds, wait for a completed save and reload. It should restore paused.
7. Complete the trip, reload and verify history.
8. Open another browser identity. It should get its own seeded workspace and cannot read the first UID's data under the supplied rules.

The implementation has unit tests with an injected Firebase SDK mock. Actual Auth, Firestore requests and rule enforcement still need this live project verification (or emulator verification). Browser visual testing was unavailable in the build environment.

## Stored data

The document contains `revision`, `mutationId`, `updatedAt` (server timestamp) and `state`:

| State field | Data |
|---|---|
| `schemaVersion` | `1` |
| `units` | Ambulance IDs, graph nodes, type, crew and availability |
| `hospitals` | Fictional hospital IDs, nodes, names, services and bed counts |
| `history` | Latest 100 completed/cancelled demo trips |
| `activeTrip` | Active request and simulation checkpoint, or null |
| `settings` | Selected pickup/hospital/unit and traffic/closure toggles |

Demo data is seeded only when the authenticated user's state document does not exist. Existing cloud data takes precedence over local defaults. This first connection seeds from the current default demo state and any valid legacy local trip history; subsequent local-mode records are not automatically merged into an existing cloud workspace.

A single document is deliberately used to keep this small student project understandable and update its fleet, active trip and history atomically. It is bounded to 20 units, 20 hospitals and 100 history items, and is not intended for a large production fleet.

## Save behaviour

- Availability, dispatch, pause/resume, completion/cancellation and route-setting changes trigger a save.
- A moving simulation checkpoints every five real seconds; it does not write every animation frame.
- Reloaded active trips are always paused. Uncheckpointed movement after the last successful save can be lost on abrupt closing.
- Writes are serialized and use Firestore transactions with revision checks.
- If another tab changed the same workspace, the stale tab stops and asks you to reload the cloud copy. There is no live snapshot subscription in this version.
- Connection/save errors are visible and pause the simulation. Failed cloud operations never silently switch to local storage. Retry is available; pending edits remain in memory while the page stays open.
- Without configuration, only the explicitly labelled local mode is used.

## Replacing demo data later

Update the seeded fleet and hospital definitions in `dist/data.js` for new workspaces. For an existing workspace, pause activity in all tabs and update the relevant Firestore state records using the console, keeping the documented schema and valid graph-node IDs. Increment `revision` when editing through the console, then reload the app. Console/admin changes bypass client security rules, so preserve field types and invariants.

Real location data requires replacing the illustrative road graph and pickup definitions too. Merely replacing hospital names does not make the map or estimated routes real. Do not import real patient information into this educational demo.

## Optional Firebase CLI

The supplied `firebase.json` can also deploy rules or host the static frontend:

```sh
firebase login
firebase deploy --only firestore:rules --project YOUR_PROJECT_ID
firebase deploy --only hosting --project YOUR_PROJECT_ID
```

Install the Firebase CLI separately if you use these commands. This handoff does not run them, create billable resources or change your Firebase account. `firebase.json` includes emulator port settings for later development; the web app uses the configured cloud endpoints unless emulator connections are explicitly added.

## Official references

- [Firebase web setup](https://firebase.google.com/docs/web/setup)
- [Anonymous Authentication](https://firebase.google.com/docs/auth/web/anonymous-auth)
- [Firestore transactions](https://firebase.google.com/docs/firestore/manage-data/transactions)
- [Firestore authentication and security-rule conditions](https://firebase.google.com/docs/firestore/security/rules-conditions)
