# START - Salestra Complete Stack

**Quick reference for running the entire Salestra application**

---

## 🚀 Daily Startup (3 Commands)

### Terminal 1: Docker Services
```powershell
cd c:\Users\prajw\OneDrive\Desktop\Salestra
docker-compose up -d
```

### Terminal 2: Backend Server
```powershell
cd c:\Users\prajw\OneDrive\Desktop\Salestra\backend
npx tsx src/index.ts
```

### Terminal 3: Frontend Application
```powershell
cd c:\Users\prajw\OneDrive\Desktop\Salestra\frontend
npm run dev
```

**✅ Done!** Access the app at: http://localhost:3001

---

## 🔧 First Time Setup

**Only needed once or after fresh clone:**

### Backend Setup
```powershell
cd backend
npm install --legacy-peer-deps
npx prisma db push
npx prisma generate
```

### Frontend Setup
```powershell
cd frontend
npm install
```

---

## ✅ Verify Everything is Running

```powershell
# Check Docker containers (should show 5 running)
docker-compose ps

# Test backend API
curl http://localhost:3000/health

# Open frontend in browser
start http://localhost:3001
```

---

## 🛑 Shutdown

```powershell
# Stop backend: Press Ctrl+C in Terminal 2
# Stop frontend: Press Ctrl+C in Terminal 3

# Stop Docker services
docker-compose down
```

---

## 📊 What's Running?

| Service | Port | URL |
|---------|------|-----|
| **Frontend** | 3001 | http://localhost:3001 |
| **Backend API** | 3000 | http://localhost:3000 |
| Health Check | 3000 | http://localhost:3000/health |
| PostgreSQL | 5440 | (internal) |
| Redis | 6385 | (internal) |
| Qdrant | 6333 | http://localhost:6333 |
| Evolution API | 8080 | http://localhost:8080 |
| Ollama | 11434 | http://localhost:11434 |

---

## 🐛 Quick Troubleshooting

### Port Already in Use
```powershell
# Find process using port 3000 or 3001
netstat -ano | findstr :3000

# Kill the process
taskkill /PID <PID_NUMBER> /F
```

### Docker Not Starting
- Open Docker Desktop manually
- Wait for it to fully start
- Run `docker-compose up -d` again

### Backend Won't Start
```powershell
cd backend
rm -rf node_modules
npm install --legacy-peer-deps
```

### Frontend Won't Start
```powershell
cd frontend
rm -rf node_modules .next
npm install
```

### Database Issues
```powershell
cd backend
npx prisma db push --force-reset
npx prisma generate
```

---

## ⚙️ Configuration

### Optional: Enable AI Features
Edit `backend/.env`:
```bash
OPENAI_API_KEY=sk-proj-YOUR-KEY-HERE
```

### Optional: Meta WhatsApp API
See [QUICKSTART.md](QUICKSTART.md#meta-whatsapp-api-integration) for full setup

---

## 📚 More Documentation

- **Complete Setup Guide:** [QUICKSTART.md](QUICKSTART.md)
- **Architecture Overview:** [ARCHITECTURE_STATUS.md](ARCHITECTURE_STATUS.md)
- **Meta API Guide:** [parallel_implementation_guide.md](backend/docs/)

---

## 💡 Pro Tips

### Quick Restart (Docker already running)
```powershell
# Just run backend & frontend
cd backend && npx tsx src/index.ts
# New terminal:
cd frontend && npm run dev
```

### View Logs
```powershell
# Docker logs
docker-compose logs -f

# Backend logs: Visible in Terminal 2
# Frontend logs: Visible in Terminal 3
```

### Database Studio
```powershell
cd backend
npx prisma studio
# Opens at http://localhost:5555
```

---

**🎉 Your Salestra stack is ready!**

For detailed documentation, see [QUICKSTART.md](QUICKSTART.md)
