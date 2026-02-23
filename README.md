# Uniq Social

A social matching/chat app where users receive one curated chat partner per day during a fixed window (8 PM – 12 AM). Conversations are scored internally based on responsiveness, and future matches are influenced by this behavior.

## Architecture

```
┌─────────────────────────────────────────────────┐
│                React Native (Expo)              │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌───────────┐   │
│  │ Auth │  │ Home │  │ Chat │  │  Profile   │   │
│  └──┬───┘  └──┬───┘  └──┬───┘  └─────┬─────┘   │
│     │         │         │             │          │
│     └─────────┴────┬────┴─────────────┘          │
│                    │                             │
│    ┌───────────────┴───────────────┐             │
│    │  Zustand Stores + API Layer   │             │
│    └───────────────┬───────────────┘             │
└────────────────────┼────────────────────────────┘
                     │  REST + WebSocket
┌────────────────────┼────────────────────────────┐
│                    │  Go Backend (Chi)           │
│    ┌───────────────┴───────────────┐             │
│    │         HTTP Router           │             │
│    └───┬────┬────┬────┬────┬──────┘             │
│        │    │    │    │    │                      │
│   Auth User Match Chat Scoring                   │
│        │    │    │    │    │                      │
│    ┌───┴────┴────┴────┴────┴──────┐             │
│    │     PostgreSQL + Redis       │             │
│    └──────────────────────────────┘             │
└──────────────────────────────────────────────────┘
```

## Tech Stack

| Layer     | Technology                                      |
|-----------|------------------------------------------------|
| Frontend  | React Native, Expo, Expo Router, Zustand       |
| Backend   | Go, Chi router, pgx, gorilla/websocket          |
| Database  | PostgreSQL 16                                    |
| Cache     | Redis 7                                          |
| Auth      | JWT (access + refresh tokens), bcrypt            |
| Realtime  | WebSockets with Redis Pub/Sub                    |

## Project Structure

```
UniqSocial/
├── backend/                    # Go backend
│   ├── cmd/server/main.go      # Entry point
│   ├── internal/
│   │   ├── auth/               # JWT auth + middleware
│   │   ├── user/               # User profile CRUD
│   │   ├── matcher/            # Matching algorithm + scheduler
│   │   ├── chat/               # WebSocket chat hub + handlers
│   │   ├── scoring/            # Engagement scoring engine
│   │   └── db/                 # Database + migrations
│   ├── pkg/
│   │   ├── config/             # Environment config
│   │   └── response/           # HTTP response helpers
│   ├── migrations/             # SQL migration files
│   ├── Dockerfile
│   └── .env
├── frontend/                   # React Native (Expo)
│   ├── app/                    # Expo Router pages
│   │   ├── (auth)/             # Login + Signup
│   │   ├── (tabs)/             # Home + Profile tabs
│   │   ├── match/[id].tsx      # Chat screen
│   │   └── chat-ended/[id].tsx # Chat ended screen
│   ├── store/                  # Zustand state stores
│   ├── services/               # API + WebSocket clients
│   ├── types/                  # TypeScript type definitions
│   └── constants/              # Colors, config
├── docker-compose.yml
└── README.md
```

## Getting Started

### Prerequisites

- Go 1.22+
- Node.js 18+
- Docker & Docker Compose
- Expo CLI (`npm install -g expo-cli`)

### Backend Setup

1. Start PostgreSQL and Redis:

```bash
docker-compose up postgres redis -d
```

2. Run the Go backend:

```bash
cd backend
cp .env.local .env
go run ./cmd/server/
```

The API server starts on `http://localhost:8080`.

### Frontend Setup

1. Install dependencies:

```bash
cd frontend
npm install
```

2. Start the Expo dev server:

```bash
npx expo start
```

3. Open on your device with Expo Go, or press `i` for iOS simulator / `a` for Android emulator.

### Full Stack (Docker)

```bash
docker-compose up --build
```

## API Endpoints

### Authentication
| Method | Path               | Description           |
|--------|--------------------|-----------------------|
| POST   | /api/auth/signup   | Register new user     |
| POST   | /api/auth/login    | Login                 |
| POST   | /api/auth/refresh  | Refresh access token  |

### Users
| Method | Path                  | Description           |
|--------|-----------------------|-----------------------|
| GET    | /api/users/me         | Get current profile   |
| PUT    | /api/users/me         | Update profile        |
| PUT    | /api/users/me/location| Update location       |

### Matching
| Method | Path              | Description             |
|--------|-------------------|-------------------------|
| GET    | /api/match/today  | Get today's match       |
| POST   | /api/match/find   | Find a match on-demand  |

### Chat
| Method | Path                          | Description           |
|--------|-------------------------------|-----------------------|
| GET    | /api/chat/ws                  | WebSocket connection  |
| GET    | /api/chat/{sessionId}/messages| Get message history   |
| POST   | /api/chat/{sessionId}/end     | End chat session      |

## Key Features

- **Daily Matching**: One curated match per user per day during the 8 PM – 12 AM window
- **Proximity-Based**: Matches prioritize users within ~50km using Haversine formula
- **Engagement Scoring**: Internal scoring tracks reply speed, conversation volume, and chat completion
- **Real-time Chat**: WebSocket-powered messaging with typing indicators
- **Auto-Cleanup**: Scheduler ends active chats at midnight and computes engagement scores
- **Token Rotation**: Short-lived access tokens (15 min) with automatic refresh

## Environment Variables

| Variable        | Description                    | Default                          |
|-----------------|--------------------------------|----------------------------------|
| DATABASE_URL    | PostgreSQL connection string   | postgres://...localhost:5432/... |
| REDIS_URL       | Redis connection string        | redis://localhost:6379/0         |
| JWT_SECRET      | Secret for signing JWT tokens  | dev-secret-key                   |
| JWT_ACCESS_TTL  | Access token lifetime          | 15m                              |
| JWT_REFRESH_TTL | Refresh token lifetime         | 168h (7 days)                    |
| SERVER_PORT     | HTTP server port               | 8080                             |
