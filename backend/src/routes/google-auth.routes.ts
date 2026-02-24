import { Router } from 'express';
import { GoogleAuthController } from '../controllers/google-auth.controller';

const router = Router();
const controller = new GoogleAuthController();

// GET /api/auth/google - Initiate OAuth flow
router.get('/google', (req, res) => controller.initiateAuth(req, res));

// GET /api/auth/google/callback - Handle OAuth callback
router.get('/google/callback', (req, res) => controller.handleCallback(req, res));

export default router;
