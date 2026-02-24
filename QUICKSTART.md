# Salestra - Quick Start Guide

## Prerequisites

Before starting, ensure you have:
- ✅ Node.js 20+ installed
- ✅ Docker Desktop installed and running
- ✅ OpenAI API key (get one at platform.openai.com)

## Setup Steps

### 1. Start Infrastructure (2 minutes)

Open terminal in the `Salestra` directory:

```bash
docker-compose up -d
```

This starts:
- PostgreSQL database (port 5440)
- Redis cache (port 6385)
- Qdrant vector database (port 6333)
- Evolution API for WhatsApp (port 8080)
- Ollama LLM (port 11434)

Verify all containers are running:
```bash
docker-compose ps
```

### 2. Configure Backend (1 minute)

Edit `backend/.env` and add your OpenAI API key:

```bash
# Find this line:
OPENAI_API_KEY="sk-proj-YOUR-API-KEY-HERE"

# Replace with your actual key:
OPENAI_API_KEY="sk-proj-abc123..."
```

**All other settings are pre-configured!**

### 3. Install Dependencies (3-5 minutes)

```bash
cd backend
npm install --legacy-peer-deps
```

### 4. Setup Database Schema (1 minute)

```bash
# Still in backend directory
npx prisma db push
npx prisma generate
```

### 5. Start Backend Server (30 seconds)

```bash
# Start the server (recommended method)
npx tsx src/index.ts

# Alternative: Use esbuild (less verbose errors)
# npm run dev
```

**✅ Success! You should see:**
```
2026-02-10 11:48:47 info: ✅ Database connected successfully
2026-02-10 11:48:47 info: ✅ Redis connected successfully
2026-02-10 11:48:48 info: 🚀 Salestra API running on port 3000
2026-02-10 11:48:48 info: ❤️ Health check: http://localhost:3000/health
```

Test the server:
```bash
curl http://localhost:3000/health
```

### 6. Test the API (10 seconds)

Open another terminal:

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-01-18T...",
  "uptime": 5.2
}
```

✅ **Backend is now live!**

---

## Next Steps

### Register a Test Business

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "businessName": "My Test Shop",
    "email": "test@example.com",
    "password": "password123",
    "whatsappNumber": "1234567890"
  }'
```

You'll receive a JWT token in the response.

### Connect WhatsApp (Evolution API)

1. Open Evolution API dashboard: `http://localhost:8080`
2. API Key: `salestra_evolution_key_2026` (from .env)
3. Create instance and scan QR code with WhatsApp

### View Database

```bash
cd backend
npm run db:studio
```

Opens Prisma Studio at `http://localhost:5555` to browse data.

---

## Meta WhatsApp API Integration (Parallel Support)

Salestra now supports the **Official Meta WhatsApp Cloud API** alongside Evolution API.

### Why Meta API?
- ✅ Official, stable, versioned API
- ✅ Won't break with WhatsApp updates
- ✅ Better long-term reliability

### Setup Meta for a Tenant

1. **Get Meta Credentials**
   - Go to [Meta Developer Portal](https://developers.facebook.com/)
   - Create WhatsApp Business App
   - Get: Phone Number ID + Access Token

2. **Update Database**
   ```bash
   # Option A: Using Prisma Studio
   npm run db:studio
   # Navigate to Tenant table, find your tenant, add:
   # metaPhoneNumberId: YOUR_PHONE_NUMBER_ID
   # metaAccessToken: YOUR_ACCESS_TOKEN
   
   # Option B: Using SQL
   # In your SQL client:
   UPDATE "Tenant" 
   SET "meta_phone_number_id" = 'YOUR_PHONE_ID', 
       "meta_access_token" = 'YOUR_TOKEN' 
   WHERE "whatsapp_instance_id" = 'YOUR_INSTANCE';
   ```

3. **Configure Webhook in Meta App**
   - Callback URL: `https://your-domain.com/api/webhooks-meta`
   - Verify Token: `salestra_meta_token` (from `.env`)
   - Subscribe to: `messages`

4. **Test**
   - Send a message to your Meta WhatsApp number
   - Check backend logs for `[MetaWebhook] Received Meta payload`

### How It Works
- The system auto-detects if a tenant uses Meta or Evolution
- Workers, queues, and AI processing remain unchanged
- Messages from both sources are processed identically

---

## Development Workflow

### Watch Logs

```bash
cd backend
npm run dev
```

All requests, AI executions, and errors are logged in real-time.

### Test Message Flow Locally

Since WhatsApp requires a real phone number, for local testing you can:

1. **Option A:** Use Evolution API's built-in testing
   - Send messages through their API
   
2. **Option B:** Direct API testing
   ```bash
   # Simulate a webhook event
   curl -X POST http://localhost:3000/api/webhooks/whatsapp \
     -H "Content-Type: application/json" \
     -d '{...webhook payload...}'
   ```

3. **Option C:** Connect a real WhatsApp number
   - Scan QR code in Evolution API
   - Send actual WhatsApp messages

---

## Troubleshooting

### "Cannot connect to database"
```bash
# Check if PostgreSQL container is running
docker ps

# Restart if needed
docker-compose restart postgres
```

### "Redis connection failed"
```bash
docker-compose restart redis
```

### "OpenAI API error"
- Check your API key in `backend/.env`
- Ensure you have credits in your OpenAI account

### "Evolution API not responding"
```bash
docker-compose logs evolution-api
```

---

## Project Structure Reference

```
Salestra/
├── backend/                 # Node.js/TypeScript API
│   ├── src/
│   │   ├── api/            # Routes (auth, webhooks)
│   │   ├── services/       # Business logic
│   │   ├── workers/        # Background jobs
│   │   └── lib/            # Utilities
│   ├── prisma/
│   │   └── schema.prisma   # Database schema
│   └── .env                # Configuration
├── docker-compose.yml       # Infrastructure
└── README.md               # Full documentation
```

---

## Useful Commands

```bash
# View all containers
docker-compose ps

# View container logs
docker-compose logs -f [service-name]

# Stop all containers
docker-compose down

# Reset database (careful!)
docker-compose down -v
docker-compose up -d
cd backend && npm run db:push
```

---

## What's Running?

- **Backend API:** `http://localhost:3000`
- **Evolution API:** `http://localhost:8080`
- **Prisma Studio:** `http://localhost:5555` (when running `npm run db:studio`)
- **PostgreSQL:** `localhost:5432` (internal)
- **Redis:** `localhost:6379` (internal)
- **Qdrant:** `http://localhost:6333` (internal)

---

## Ready for Development! 🚀

Your Salestra backend is fully operational. The system will:
- ✅ Receive WhatsApp messages via webhooks
- ✅ Queue them for processing
- ✅ Execute AI agents with RAG
- ✅ Send intelligent responses
- ✅ Log everything for observability

**Next:** Build the frontend admin dashboard or start testing with real WhatsApp messages!
