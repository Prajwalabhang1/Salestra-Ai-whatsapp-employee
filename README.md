# Salestra - AI Automation SaaS Platform

**Production-grade AI automation SaaS that gives businesses their own AI employee on WhatsApp.**

## 🚀 Features

- **WhatsApp-First**: Native WhatsApp integration via Evolution API
- **AI-Powered**: AI agents with GROQ API
- **Multi-Tenant**: Complete tenant isolation at all layers
- **Production-Ready**: Enterprise-grade security, monitoring, and scalability
- **Zero Technical Knowledge Required**: 10-minute onboarding for businesses

## 🏗️ Architecture

```
WhatsApp Customer → Evolution API → Webhook Gateway → Message Queue
→ Tenant Resolver → AI Agent Runtime → RAG Engine → Response Generator
→ WhatsApp Reply
```

### Tech Stack

- **Backend**: Node.js + TypeScript + Express
- **Database**: PostgreSQL (Prisma ORM)
- **Vector Store**: Qdrant
- **Cache/Queue**: Redis + Bull
- **AI**: OpenAI GPT-4o + Embeddings
- **WhatsApp**: Evolution API
- **Frontend**: Next.js 14 + Tailwind CSS

## 🛠️ Setup

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- OpenAI API key

### Quick Start

1. **Clone and install dependencies**

```bash
cd backend
npm install
```

2. **Start infrastructure with Docker**

```bash
docker-compose up -d
```

This starts:
- PostgreSQL (port 5432)
- Redis (port 6379)
- Qdrant (port 6333)
- Evolution API (port 8080)

3. **Configure environment**

```bash
cp backend/.env.example backend/.env
```

Edit `.env` and add your OpenAI API key.

4. **Setup database**

```bash
cd backend
npm run db:push
npm run db:generate
```

5. **Start backend**

```bash
npm run dev
```

The API will be available at `http://localhost:3000`

## 📡 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new business
- `POST /api/auth/login` - Login

### Webhooks
- `POST /api/webhooks/whatsapp` - WhatsApp message receiver

### Health
- `GET /health` - API health check

## 🔧 Development

### Database Management

```bash
# View database
npm run db:studio

# Create migration
npm run db:migrate

# Push schema changes
npm run db:push
```

### Message Queue

The message queue automatically processes WhatsApp messages through the AI agent. Monitor in logs.

## 📊 System Flow

1. **Customer sends WhatsApp message** → Evolution API receives
2. **Webhook triggers** → Message saved to database
3. **Queued for processing** → Bull queue (Redis)
4. **Worker processes message**:
   - Resolve tenant
   - Load AI personality
   - RAG retrieval (hybrid search)
   - Execute AI agent with tools
   - Generate response
5. **Send response** → Evolution API → WhatsApp customer
6. **Log everything** → Execution logs for observability

## 🔒 Security

- Multi-tenant isolation (database + vector store)
- JWT authentication
- Rate limiting
- Input validation
- Audit logging
- Encrypted credentials

## 📦 Project Structure

```
backend/
├── src/
│   ├── api/              # API routes
│   ├── services/         # Business logic
│   │   ├── tenant/       # Multi-tenancy
│   │   ├── whatsapp/     # Evolution API integration
│   │   ├── rag/          # RAG engine
│   │   ├── ai-agent/     # AI agent runtime
│   │   └── queue/        # Message queue
│   ├── workers/          # Background jobs
│   ├── lib/              # Utilities
│   └── index.ts          # Entry point
├── prisma/
│   └── schema.prisma     # Database schema
└── package.json
```

## 🚢 Production Deployment

See `implementation_plan.md` for production deployment architecture (Kubernetes, monitoring, scaling).

## 📝 License

MIT

## 🤝 Contributing

This is a production SaaS platform. Contributions welcome!

---

Built with ❤️ for businesses that want AI employees on WhatsApp.
