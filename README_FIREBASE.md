# Firebase upgrade guide

## Files added
- `src/firebase.js`
- `src/firestoreService.js`
- Firebase auth + Firestore sync inside `src/App.jsx`

## Setup
1. Run `npm install`
2. Create a Firebase project
3. Add a **Web app** in Firebase
4. Enable **Authentication > Email/Password**
5. Create a **Cloud Firestore** database

## Add .env file
Create a file named `.env` in the project root:

VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id

## Firestore rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}

## Build and deploy
- `npm run build`
- Upload the `dist` folder to Netlify
