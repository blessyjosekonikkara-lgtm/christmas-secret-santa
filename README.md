# 🎄 SECRET SANTA – Christmas Friend Exchange Platform
> *"A Little Surprise, A Lot of Christmas Magic!"*

A private, elegant Christmas Secret Santa platform engineered for 46 family members. Features continuous snowfall across every page, passwordless email authentication, exact name verification with multi-family member registration per email, cryptographically secure Fisher-Yates derangement, automatic remembrance of revealed friends, and a dedicated administrator console for `blessyjosekonikkara@gmail.com`.

---

## 🎅 Key Features
1. **Continuous Falling Snow**: 60 FPS HTML5 Canvas snowfall running globally across all routes without interruption.
2. **Passwordless Email Authentication**: Firebase Email-Link magic authentication. No passwords to remember or reset.
3. **Multi-Member Registration**: One verified family email can register multiple members (e.g. JOSE, BINDU, BLESSY) while maintaining 1-to-1 unique Secret Santa pairings.
4. **Automatic Remembrance**: Once a participant unboxes their Christmas friend, the name is permanently remembered in Firestore. No redraws, reshuffling, or repeat unboxing needed.
5. **Admin Dashboard**: Restricted to `blessyjosekonikkara@gmail.com` with server-side authorization:
   - View roster (46 members), registration & verification status.
   - Add new participants after deployment.
   - Edit participant names.
   - Delete participants with assignment safety checks.
   - Generate, validate, inspect, and lock Secret Santa assignments permanently.
6. **4-Dummy Testing Environment**: Isolated sandbox testing (ALICE, BOB, CHARLIE, DAVID) with automated test runners.

---

## 🚀 Local Quickstart
```bash
# 1. Navigate to frontend
cd frontend

# 2. Run local development server
npm run dev

# 3. Open in browser:
# http://localhost:5173
```

---

## ☁️ Firebase Production Deployment
To deploy this project to Firebase:
1. Log in to Firebase CLI:
   ```bash
   npx firebase-tools login
   ```
2. Select your Firebase project:
   ```bash
   npx firebase-tools use --add
   ```
3. Deploy Firestore rules, Cloud Functions, and Hosting:
   ```bash
   npx firebase-tools deploy
   ```
