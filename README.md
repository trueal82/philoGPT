# PhiloGPT Backend

A backend application for an LLM chat application with support for multiple bots, user authentication, and persistent chat sessions.

## Features

- User authentication via local email/password and OAuth providers (Google, GitHub)
- User profiles with customizable settings
- Multiple bot identities with distinct personalities
- Persistent chat sessions with message history
- Real-time communication support (WebSocket)
- Admin panel for user management and system configuration
- LLM configuration management
- Playground for testing bot functionality

## Technologies Used

- **Backend**: Node.js with Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT with Passport.js
- **Real-time**: Socket.IO
- **Security**: Helmet.js, CORS, bcrypt.js

## Project Structure

```
src/
├── server.js              # Main server file
├── models/                # Database models
│   ├── User.js
│   ├── Profile.js
│   ├── Bot.js
│   ├── ChatSession.js
│   ├── Message.js
│   ├── LLMConfig.js
│   ├── SystemPrompt.js
│   └── PlaygroundSession.js
├── routes/                # API routes
│   ├── auth.js
│   ├── bots.js
│   ├── chat.js
│   ├── admin.js
│   └── playground.js
├── middleware/            # Custom middleware
│   └── auth.js
├── config/                # Configuration files
│   └── passport.js
└── tests/                 # Test files
```

## Installation

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables in `.env` file
4. Start MongoDB via the project Mongo service: `./start-mongodb.sh`
5. Run the application: `npm run dev`

## MongoDB Ownership And Seeding

- Seeding is owned by the top-level `mongodb/` module only.
- The seed file lives at `mongodb/initDefaultData.ts`.
- The Mongo container starts `mongod`, checks whether the configured DB is empty, and seeds only if empty.
- The backend no longer performs any startup seeding.

Useful commands:

- `./start-mongodb.sh` - start MongoDB container with empty-check seed behavior.
- `./start-mongodb.sh --purge` - drop app collections and reseed on startup.

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/philogpt
JWT_SECRET=your-super-secret-jwt-key-here
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
OPENAI_API_KEY=your-openai-api-key
OLLAMA_API_URL=http://localhost:11434
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/google` - Google OAuth login
- `GET /api/auth/github` - GitHub OAuth login

### Bots
- `GET /api/bots` - Get all bots
- `GET /api/bots/:id` - Get specific bot
- `POST /api/bots` - Create new bot (admin only)
- `PUT /api/bots/:id` - Update bot (admin only)
- `DELETE /api/bots/:id` - Delete bot (admin only)

### Chat
- `GET /api/chat/sessions` - Get user's chat sessions
- `POST /api/chat/sessions` - Create new chat session
- `GET /api/chat/sessions/:id/messages` - Get messages for a session
- `POST /api/chat/sessions/:id/messages` - Send message to bot
- `DELETE /api/chat/sessions/:id` - Delete chat session

### Admin
- `GET /api/admin/users` - Get all users (admin only)
- `GET /api/admin/users/:id` - Get specific user (admin only)
- `PUT /api/admin/users/:id/role` - Update user role (admin only)
- `DELETE /api/admin/users/:id` - Delete user (admin only)
- `GET /api/admin/llm-configs` - Get all LLM configurations (admin only)
- `POST /api/admin/llm-configs` - Create LLM configuration (admin only)
- `PUT /api/admin/llm-configs/:id` - Update LLM configuration (admin only)
- `DELETE /api/admin/llm-configs/:id` - Delete LLM configuration (admin only)
- `GET /api/admin/system-prompt` - Get system prompt (admin only)
- `PUT /api/admin/system-prompt` - Update system prompt (admin only)

### Playground
- `GET /api/playground/bots` - Get available bots for playground
- `POST /api/playground/sessions` - Start a new playground session
- `POST /api/playground/messages` - Send message to bot in playground

## Running Tests

```bash
npm test
```

## Development

```bash
npm run dev  # Start development server with nodemon
npm start    # Start production server
```

## License

MIT