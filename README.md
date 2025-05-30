# WhatsApp Automation Server

This is the server component of the WhatsApp Automation application. It provides a RESTful API for authenticating users, connecting to WhatsApp, and sending messages.

## Features

- User authentication (register, login, profile management)
- WhatsApp connection via QR code
- Send messages and files via WhatsApp
- API documentation
- Message history tracking

## Prerequisites

- Docker and Docker Compose installed on your server
- Port 5000 available for the API server

## Deployment with Docker

### 1. Clone the repository

```bash
git clone <your-repository-url>
cd <repository-name>/server
```

### 2. Configuration

Create a `.env` file in the server directory:

```bash
touch .env
```

Add the following environment variables:

```
MONGODB_URI=mongodb://mongodb:27017/whatsapp-automation
JWT_SECRET=your_secure_jwt_secret_key_here
PORT=5000
NODE_ENV=production
```

Make sure to replace `your_secure_jwt_secret_key_here` with a strong, random string.

### 3. Build and start the containers

```bash
docker-compose up -d
```

This will start:
- The WhatsApp Automation server on port 5000
- A MongoDB instance

### 4. Check the server status

```bash
docker-compose ps
```

### 5. View the logs

```bash
docker-compose logs -f server
```

## API Endpoints

### Authentication
- `POST /api/auth/register`: Register a new user
- `POST /api/auth/login`: Login a user
- `GET /api/auth/me`: Get current user profile

### WhatsApp
- `GET /api/whatsapp/init`: Initialize WhatsApp connection
- `GET /api/whatsapp/status`: Check connection status
- `POST /api/whatsapp/disconnect`: Disconnect WhatsApp
- `POST /api/whatsapp/send`: Send a message
- `POST /api/whatsapp/send-file`: Send a file

### User
- `PUT /api/user/profile`: Update user profile
- `PUT /api/user/password`: Change password
- `POST /api/user/api-key`: Generate API key
- `GET /api/user/plans`: Get available plans
- `POST /api/user/upgrade-plan`: Upgrade to a new plan

## Security

- The application uses JWT for authentication
- Passwords are securely hashed
- Environment variables are used for sensitive information

## Maintenance

### Backups

The MongoDB data is stored in a Docker volume. To backup this data:

```bash
docker-compose exec mongodb mongodump --out /data/backup
docker cp <container_id>:/data/backup ./backup
```

### Updates

To update the server to a new version:

```bash
git pull
docker-compose down
docker-compose build
docker-compose up -d
```

### Stopping the server

```bash
docker-compose down
``` #   W w e b - t e s t i n g  
 