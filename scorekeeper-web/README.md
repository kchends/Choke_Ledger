Scorekeeper Web — React + Vite + Firebase (starter)

Overview
- Single-page app using React + Vite
- Stores players in Firebase Firestore (real-time)
- Public read/write Firestore rules (easy sharing) — update rules for security in production
- Export CSV download

Setup
1. Install Node 18+ (use nvm-windows recommended).
2. Open project folder:
   cd C:\Users\kevchen\scorekeeper-web
3. Install dependencies:
   npm install
4. Create a Firebase project: https://console.firebase.google.com/
   - Add a web app and copy the config values.
   - Enable Firestore (Native mode).
5. Edit src/firebase.js and replace the firebaseConfig object with your values.
6. For testing, set Firestore rules to allow public read/write (not for production):
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if true;
       }
     }
   }
7. Run dev server:
   npm run dev
   Open the printed localhost URL in browser.
8. To deploy publicly, use Firebase Hosting or any static host. To use Firebase Hosting:
   - Install Firebase CLI: npm install -g firebase-tools
   - firebase login
   - firebase init hosting (choose build output "dist")
   - npm run build
   - firebase deploy --only hosting

Next steps I can do for you
- Deploy this to Firebase Hosting and configure Firestore rules
- Add optional Google Sign-In or basic username prompts to identify users
- Add per-game sessions and history

Which next action should I take? (Deploy to Firebase Hosting / Configure rules / Add user-identifiers / Nothing)