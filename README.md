# 🎄 SECRET SANTA – Christmas Friend Exchange Platform
> *"A Little Surprise, A Lot of Christmas Magic!"*

A Christmas Secret Santa exchange for 45 family members, with passwordless email sign-in, registration for multiple names under one family email, and an administrator console for `blessyjosekonikkara@gmail.com`.

---

## 🎅 Key Features
1. **Continuous Falling Snow**: 60 FPS HTML5 Canvas snowfall running globally across all routes without interruption.
2. **Passwordless Email Authentication**: Firebase Email-Link magic authentication. No passwords to remember or reset.
3. **Multi-Member Registration**: One verified family email can register multiple members (e.g. JOSE, BINDU, BLESSY) while maintaining 1-to-1 unique Secret Santa pairings.
4. **Automatic Remembrance**: The shared database records when a participant unboxes their Christmas friend.
5. **Admin Dashboard**: Restricted to `blessyjosekonikkara@gmail.com` with server-side authorization:
   - View the 45-member roster, registrations, and verification status.
   - Add new participants after deployment.
   - Edit participant names.
   - Delete participants with assignment safety checks.
   - Generate, validate, inspect, and lock Secret Santa assignments permanently.
6. **4-Dummy Testing Environment**: Isolated sandbox testing (ALICE, BOB, CHARLIE, DAVID) with automated test runners.

---

## Local checks

```bash
npm ci
npm ci --prefix frontend
npm test
npm run build --prefix frontend
```

Use Node.js 24. Run `npm run dev --prefix frontend` for the UI on port 5173. The Vite development server serves the React app. The shared API is deployed alongside the site on Vercel.

## Deploy registration and the admin dashboard

1. In the existing Vercel project, set **Root Directory** to the repository root (leave the field blank) and use Node.js 24. The root `vercel.json` builds `frontend/dist` and Vercel serves the functions in `api/` on the same domain. A static frontend or Firebase Hosting alone leaves the `/api` functions unavailable. [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite)
2. In Vercel **Environment Variables**, set the server-side `MONGODB_URI` and `MONGODB_DB_NAME` from [the environment template](.env.example). If the app already has an Atlas database, use that same database to keep its registrations. The database user needs read and write access and Atlas must permit connections from the deployment. [Atlas connection troubleshooting](https://www.mongodb.com/docs/atlas/troubleshoot-connection/)
3. Set the four `VITE_FIREBASE_*` variables from the same Firebase web app. In Firebase Authentication, enable Email/Password and Email link sign-in, and add the family's site domain to **Authorized domains**. Firebase verifies the email and MongoDB stores the registration. [Firebase email link setup](https://firebase.google.com/docs/auth/web/email-link-auth)
4. Redeploy. Open `/api/participants` on the deployed domain. It should return HTTP 200 with the roster as JSON. Then have a family member open their email link and register their own name. In a separate browser session, sign in as the organizer and check **Admin → Registered** for that name, email, and registration date.

## Recover earlier registrations

Family members who registered before the fix should reopen the same site address in the browser they originally used and sign in with the same email. The app retries that browser's saved claims against MongoDB. If the claim is already linked to their email, MongoDB keeps the existing registration. If the device has no saved registration, the family member can select their name and register again.

If an older deployment used Firestore, check that project's `participants` collection before asking family members to register again. The current app reads registrations from MongoDB.
