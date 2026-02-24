import { Request, Response } from 'express';
// import { google } from 'googleapis';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/* Google OAuth disabled - googleapis not installed
const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback'
);
*/

export class GoogleAuthController {
    // Initiate Google OAuth
    async initiateAuth(req: Request, res: Response) {
        try {
            const scopes = [
                'https://www.googleapis.com/auth/userinfo.email',
                'https://www.googleapis.com/auth/userinfo.profile'
            ];

            const authUrl = oauth2Client.generateAuthUrl({
                access_type: 'offline',
                scope: scopes,
                state: req.query.state as string || 'signup'
            });

            res.json({ authUrl });
        } catch (error) {
            console.error('Google auth initiation error:', error);
            res.status(500).json({ error: 'Failed to initiate Google authentication' });
        }
    }

    // Handle Google OAuth callback
    async handleCallback(req: Request, res: Response) {
        try {
            const { code, state } = req.query;

            if (!code) {
                return res.redirect('http://localhost:3001/signup?error=No authorization code');
            }

            // Exchange code for tokens
            const { tokens } = await oauth2Client.getToken(code as string);
            oauth2Client.setCredentials(tokens);

            // Get user info from Google
            const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
            const { data } = await oauth2.userinfo.get();

            if (!data.email) {
                return res.redirect('http://localhost:3001/signup?error=No email from Google');
            }

            // Check if user exists
            let user = await prisma.tenant.findUnique({
                where: { email: data.email }
            });

            let needsOnboarding = false;

            if (!user) {
                // Create new user
                user = await prisma.tenant.create({
                    data: {
                        email: data.email,
                        passwordHash: '', // No password for OAuth users
                        status: 'signup_complete'
                    }
                });
                needsOnboarding = true;
            } else {
                // Existing user - check onboarding status
                needsOnboarding = user.status === 'signup_complete';
            }

            // Generate JWT token
            const token = jwt.sign(
                { userId: user.id, email: user.email },
                process.env.JWT_SECRET || 'your-secret-key',
                { expiresIn: '7d' }
            );

            // Redirect to frontend with token
            const redirectUrl = needsOnboarding
                ? `http://localhost:3001/onboarding?token=${token}`
                : `http://localhost:3001/conversations?token=${token}`;

            res.redirect(redirectUrl);
        } catch (error) {
            console.error('Google OAuth callback error:', error);
            res.redirect('http://localhost:3001/signup?error=Authentication failed');
        }
    }
}
