# ChatSphere — Distributed Real-Time Chat Application

ChatSphere is a distributed real-time chat application built for a college mini-project. It demonstrates key distributed computing principles, fault handling, real-time bidirectional communication via WebSockets, and database persistence.

---

## Key Features

1. **User Authentication**: Secure JWT-based authentication with bcrypt password hashing.
2. **Real-Time 1-to-1 Messaging**: Direct messaging with Socket.IO rooms, delivery (`✓✓`), and read receipts.
3. **Group Chat Rooms**: Dynamic group room creation, multi-user broadcasting, member management, and admin access controls.
4. **Distributed Reliability & Idempotency**:
   - Multi-tab connection tracking (prevents premature offline states).
   - Client-generated idempotency keys (`clientMessageId`) preventing duplicate messages.
   - Automatic offline reconnection with message synchronization (`GET /api/conversations/:id/messages?after=<id>`).
   - Message delivery retry on network dropouts.
5. **Pagination**: Progressive cursor/offset pagination (`?page=1&limit=30`).
6. **Telemetry & Health Endpoint**: Real-time cluster health check (`GET /api/health`).
7. **Clean, Minimalist UI**: Responsive on mobile (320px–430px) and desktop (1024px–1440px).

---

## Technology Stack

- **Frontend**: React 19, Vite, Tailwind CSS, Lucide Icons, Socket.IO Client
- **Backend**: Node.js, Express 5, Socket.IO, Mongoose, Morgan, Express-Rate-Limit
- **Database**: MongoDB (Local or Atlas) with indexing

---

## How to Run the Application

### 1. Prerequisites
- Node.js (v18+)
- MongoDB running locally (`mongodb://localhost:27017/distributed-chat`)

### 2. Backend Setup
```bash
cd backend
npm install
node server.js
```
The backend server runs on `http://localhost:5000`.

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
The frontend Vite server runs on `http://localhost:5173`.

---

## API Endpoints

- `GET /api/health` — Cluster health and active connection stats
- `POST /api/auth/register` — Register a new account
- `POST /api/auth/login` — Sign in and receive JWT token
- `GET /api/auth/me` — Get current user profile
- `GET /api/users/search?q=<query>` — Search registered users
- `GET /api/conversations` — Fetch user conversations
- `POST /api/conversations` — Create or open direct conversation
- `POST /api/conversations/group` — Create new group room
- `PUT /api/conversations/:id/group` — Update group name / description
- `PUT /api/conversations/:id/group/add` — Add group member
- `PUT /api/conversations/:id/group/remove` — Remove group member
- `PUT /api/conversations/:id/group/leave` — Leave group room
- `GET /api/conversations/:id/messages?page=1&limit=30` — Paginated chat messages
- `GET /api/conversations/:id/messages?after=<id>` — Reconnection message sync
