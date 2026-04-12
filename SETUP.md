# Solo Leveling — Setup Instructions

## Prerequisites
- Node.js 18+
- Firebase project (with Firestore + Auth enabled)

---

## 1. Firebase Setup

### Create a Firebase project
1. Go to https://console.firebase.google.com
2. Create a new project
3. Enable **Authentication** → Sign-in methods → **Email/Password** + **Google**
4. Enable **Firestore Database** (start in production mode or test mode)

### Get Admin SDK credentials (for backend)
1. Project Settings → Service Accounts → Generate new private key
2. Download the JSON file
3. Extract: `project_id`, `client_email`, `private_key`

### Get Web SDK config (for frontend)
1. Project Settings → General → Your apps → Add Web App
2. Copy the firebaseConfig values

---

## 2. Backend Setup

```bash
cd backend
npm install
cp .env.example .env
```

Edit `.env`:

```
PORT=4000
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FRONTEND_URL=http://localhost:3000
```

Start the backend:
```bash
npm run dev    # development (nodemon)
npm start      # production
```

---

## 3. Frontend Setup

```bash
cd frontend
npm install
cp .env.local.example .env.local
```

Edit `.env.local`:

```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_API_URL=http://localhost:4000
```

Start the frontend:
```bash
npm run dev
```

App runs at http://localhost:3000

---

## 4. Firestore Security Rules (recommended)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /quests/{questId} {
      allow read: if request.auth != null;
    }
    match /dailyQuests/{docId} {
      allow read, write: if request.auth != null
        && resource.data.userId == request.auth.uid;
    }
  }
}
```

---

## Project Structure

```
.
├── backend/
│   ├── config/
│   │   └── firebase.js          # Admin SDK init
│   ├── routes/
│   │   ├── questRoutes.js       # /api/quests
│   │   └── userRoutes.js        # /api/users
│   ├── services/
│   │   ├── questService.js      # Quest generation + progress logic
│   │   ├── xpService.js         # XP + leveling
│   │   └── streakService.js     # Streak tracking
│   ├── server.js
│   └── .env
│
└── frontend/
    ├── app/
    │   ├── layout.tsx
    │   ├── page.tsx              # Dashboard (protected)
    │   └── login/
    │       └── page.tsx          # Auth page
    ├── components/
    │   ├── Header.tsx            # XP bar + level + streak
    │   ├── Dashboard.tsx         # Quest list
    │   ├── QuestCard.tsx         # Individual quest
    │   └── ProgressBar.tsx       # Reusable bar
    ├── context/
    │   ├── AuthContext.tsx       # Firebase user + profile
    │   └── QuestContext.tsx      # Quest state + updates
    └── lib/
        ├── firebase.ts           # Web SDK init
        ├── api.ts                # All API calls
        └── xpUtils.ts            # XP formula (shared)
```

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/users/me | Fetch or create user profile |
| GET | /api/quests/today | Today's quests for user |
| POST | /api/quests/generate | Generate today's quests (idempotent) |
| PATCH | /api/quests/:id | Update quest progress |

All endpoints require `Authorization: Bearer <firebase-id-token>`.
