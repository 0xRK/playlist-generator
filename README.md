# Playlist Generator

A web application that displays your recently played Spotify songs using the Spotify Web API.

## Setup Instructions

### Prerequisites
- Node.js installed
- A Spotify account
- Spotify Developer credentials (see below)

### 1. Install Dependencies

Install backend dependencies:
```bash
cd backend
npm install
```

Install frontend dependencies:
```bash
cd client
npm install
```
### 2. Update backend/.env to use the API Keys

Ask me for the API keys.

### 3. Run the Application

Start the backend server (from the `backend` folder):
```bash
cd backend
node server.js
```

In a separate terminal, start the frontend (from the `client` folder):
```bash
cd client
npm run dev
```

### 4. Use the App

1. Open your browser to `http://localhost:5173` (or the URL shown by Vite)
2. Click "Login with Spotify"
3. Authorize the app
4. Your recently played songs will be displayed!
