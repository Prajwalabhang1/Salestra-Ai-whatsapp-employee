import { Router, Request, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../lib/prisma.js';
import logger from '../lib/logger.js';
import { JWT_SECRET } from '../lib/jwt.js';
import { sendVerificationEmail } from '../services/email/email.service.js';
import { TRIAL_CONFIG } from '../config/trial.config.js';

const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || JWT_SECRET + '_refresh';

const router = Router();

/**
 * Register new user - Phase 1: Simple Signup
 * Only requires email + password
 * Business info collected in Phase 2 (onboarding)
 */
router.post('/register', async (req: Request, res: Response) => {
    try {
        const { email, password, termsAccepted, privacyAccepted } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }

        // Validate Legal (Phase 3.1)
        if (!termsAccepted || !privacyAccepted) {
            return res.status(400).json({ error: 'You must accept the Terms and Privacy Policy to register' });
        }

        // Password validation with enterprise security standards
        const { validatePassword } = await import('../lib/password-validator.js');
        const passwordValidation = validatePassword(password);

        if (!passwordValidation.valid) {
            return res.status(400).json({
                error: 'Password does not meet security requirements',
                details: passwordValidation.errors
            });
        }

        // Check if email already exists
        const existing = await prisma.tenant.findUnique({
            where: { email },
        });

        if (existing) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Generate email verification token
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const verificationExpires = new Date();
        verificationExpires.setHours(verificationExpires.getHours() + 24); // 24 hour expiry

        // Calculate trial dates
        const now = new Date();
        const trialEnd = new Date(now);
        trialEnd.setDate(trialEnd.getDate() + TRIAL_CONFIG.DURATION_DAYS);

        // Create minimal tenant - Phase 1
        // Business info will be collected during onboarding (Phase 2)
        const tenant = await prisma.tenant.create({
            data: {
                email,
                passwordHash,
                emailVerified: false,
                emailVerificationToken: verificationToken,
                emailVerificationExpires: verificationExpires,
                status: 'signup_complete',  // Not onboarded yet
                subscriptionTier: 'trial',
                trialStartDate: now,
                trialEndDate: trialEnd,
                subscriptionStatus: 'trial',
                paidSubscriptionTier: 'trial',
                // businessName, whatsappNumber, etc. filled in Phase 2
                termsAccepted: !!termsAccepted,
                privacyAccepted: !!privacyAccepted,
                acceptedAt: new Date(),
            },
        });

        // Generate JWT
        const token = jwt.sign(
            { tenantId: tenant.id, email: tenant.email },
            JWT_SECRET,
            { expiresIn: '30d' }
        );

        // Send verification email (non-blocking)
        sendVerificationEmail(email, verificationToken).catch(error => {
            logger.error(`Failed to send verification email to ${email}: ${error.message}`);
        });

        logger.info(`New signup: ${tenant.id} (${email}) - verification email sent`);

        res.status(201).json({
            success: true,
            message: 'Registration successful! Please check your email to verify your account.',
            user: {
                id: tenant.id,
                email: tenant.email,
                emailVerified: false,
                needsOnboarding: true,
                status: tenant.status,
            },
            token,
        });

    } catch (error: any) {
        logger.error(`Registration error: ${error.message}`);
        res.status(500).json({ error: 'Registration failed' });
    }
});

/**
 * Login
 */
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }

        const tenant = await prisma.tenant.findUnique({
            where: { email },
            include: {
                businessConfig: true
            }
        });

        if (!tenant) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const validPassword = await bcrypt.compare(password, tenant.passwordHash);

        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Issue short-lived access token (15 minutes)
        const accessToken = jwt.sign(
            { tenantId: tenant.id, email: tenant.email },
            JWT_SECRET,
            { expiresIn: '15m' }
        );

        // Issue long-lived refresh token (7 days) stored in httpOnly cookie
        const refreshToken = jwt.sign(
            { tenantId: tenant.id },
            REFRESH_TOKEN_SECRET,
            { expiresIn: '7d' }
        );

        res.cookie('refresh_token', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
            path: '/api/auth/refresh'
        });

        logger.info(`Login: ${tenant.id} (${email})`);

        const needsOnboarding = !tenant.businessName || !tenant.businessConfig || tenant.status === 'signup_complete';

        res.json({
            token: accessToken,
            user: {
                id: tenant.id,
                email: tenant.email,
                businessName: tenant.businessName,
                emailVerified: tenant.emailVerified
            },
            needsOnboarding
        });
    } catch (error: any) {
        logger.error(`Login error: ${error}`);
        res.status(500).json({ error: 'Login failed' });
    }
});

/**
 * Refresh Access Token
 * POST /api/auth/refresh
 * Uses the httpOnly refresh_token cookie to issue a new access token.
 */
router.post('/refresh', async (req: Request, res: Response) => {
    try {
        const refreshToken = req.cookies?.refresh_token;

        if (!refreshToken) {
            return res.status(401).json({ error: 'No refresh token' });
        }

        let payload: any;
        try {
            payload = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET);
        } catch {
            return res.status(401).json({ error: 'Invalid or expired refresh token' });
        }

        // Verify tenant still exists and is active
        const tenant = await prisma.tenant.findUnique({ where: { id: payload.tenantId } });
        if (!tenant || !['active', 'trial'].includes(tenant.status)) {
            return res.status(401).json({ error: 'Account inactive' });
        }

        // Issue fresh access token
        const accessToken = jwt.sign(
            { tenantId: tenant.id, email: tenant.email },
            JWT_SECRET,
            { expiresIn: '15m' }
        );

        res.json({ token: accessToken });
    } catch (error: any) {
        logger.error(`Refresh token error: ${error.message}`);
        res.status(500).json({ error: 'Failed to refresh token' });
    }
});

/**
 * Logout — clear refresh token cookie
 * POST /api/auth/logout
 */
router.post('/logout', (_req: Request, res: Response) => {
    res.clearCookie('refresh_token', { path: '/api/auth/refresh' });
    res.json({ success: true, message: 'Logged out successfully' });
});

/**
 * Verify Email
 * GET /api/auth/verify-email/:token
 */
router.get('/verify-email/:token', async (req, res) => {
    try {
        const { token } = req.params;

        // Find tenant with valid token
        const tenant = await prisma.tenant.findFirst({
            where: {
                emailVerificationToken: token,
                emailVerificationExpires: {
                    gt: new Date() // Token not expired
                }
            }
        });

        if (!tenant) {
            return res.status(400).json({
                success: false,
                error: 'Invalid or expired verification link'
            });
        }

        // Mark email as verified
        await prisma.tenant.update({
            where: { id: tenant.id },
            data: {
                emailVerified: true,
                emailVerificationToken: null,
                emailVerificationExpires: null
            }
        });

        logger.info(`Email verified: ${tenant.email}`);

        res.json({
            success: true,
            message: 'Email verified successfully!'
        });
    } catch (error: any) {
        logger.error(`Email verification error: ${error.message}`);
        res.status(500).json({
            success: false,
            error: 'Verification failed'
        });
    }
});

/**
 * Resend Verification Email
 * POST /api/auth/resend-verification
 */
router.post('/resend-verification', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email required' });
        }

        const tenant = await prisma.tenant.findUnique({
            where: { email }
        });

        if (!tenant) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (tenant.emailVerified) {
            return res.status(400).json({ error: 'Email already verified' });
        }

        // Generate new token
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const verificationExpires = new Date();
        verificationExpires.setHours(verificationExpires.getHours() + 24);

        await prisma.tenant.update({
            where: { id: tenant.id },
            data: {
                emailVerificationToken: verificationToken,
                emailVerificationExpires: verificationExpires
            }
        });

        // Send verification email
        await sendVerificationEmail(email, verificationToken);

        logger.info(`Verification email resent to ${email}`);

        res.json({
            success: true,
            message: 'Verification email sent. Please check your inbox.'
        });
    } catch (error: any) {
        logger.error(`Resend verification error: ${error.message}`);
        res.status(500).json({ error: 'Failed to resend verification email' });
    }
});

/**
 * Change Password
 * POST /api/auth/change-password
 */
router.post('/change-password', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const tenantId = req.userId;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current and new password required' });
        }

        // Get tenant
        const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
        if (!tenant) return res.status(404).json({ error: 'User not found' });

        // Verify current
        const valid = await bcrypt.compare(currentPassword, tenant.passwordHash);
        if (!valid) {
            return res.status(400).json({ error: 'Incorrect current password' });
        }

        // Validate new password strength
        const { validatePassword } = await import('../lib/password-validator.js');
        const validation = validatePassword(newPassword);
        if (!validation.valid) {
            return res.status(400).json({ error: 'Password does not meet security requirements', details: validation.errors });
        }

        // Update
        const hash = await bcrypt.hash(newPassword, 10);
        await prisma.tenant.update({
            where: { id: tenantId },
            data: { passwordHash: hash }
        });

        // Audit Log
        await prisma.auditLog.create({
            data: {
                tenantId: tenantId!,
                action: 'CHANGE_PASSWORD',
                entity: 'Auth',
                ipAddress: req.ip
            }
        });

        res.json({ success: true, message: 'Password updated successfully' });
    } catch (error: any) {
        logger.error(`Change password error: ${error.message}`);
        res.status(500).json({ error: 'Failed to change password' });
    }
});

/**
 * Forgot Password - Request Reset Link
 * POST /api/auth/forgot-password
 */
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email required' });
        }

        const tenant = await prisma.tenant.findUnique({
            where: { email }
        });

        // Security: Don't reveal if email exists or not
        if (!tenant) {
            return res.json({
                success: true,
                message: 'If an account exists with this email, you will receive a password reset link.'
            });
        }

        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetExpires = new Date();
        resetExpires.setHours(resetExpires.getHours() + 1); // 1 hour expiry

        await prisma.tenant.update({
            where: { id: tenant.id },
            data: {
                passwordResetToken: resetToken,
                passwordResetExpires: resetExpires
            }
        });

        // Send reset email
        const { sendPasswordResetEmail } = await import('../services/email/email.service.js');
        await sendPasswordResetEmail(email, resetToken);

        logger.info(`Password reset requested for ${email}`);

        res.json({
            success: true,
            message: 'If an account exists with this email, you will receive a password reset link.'
        });
    } catch (error: any) {
        logger.error(`Forgot password error: ${error.message}`);
        res.status(500).json({ error: 'Failed to process request' });
    }
});

/**
 * Reset Password with Token
 * POST /api/auth/reset-password
 */
router.post('/reset-password', async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
            return res.status(400).json({ error: 'Token and new password required' });
        }

        // Validate new password strength
        const { validatePassword } = await import('../lib/password-validator.js');
        const validation = validatePassword(newPassword);
        if (!validation.valid) {
            return res.status(400).json({
                error: 'Password does not meet security requirements',
                details: validation.errors
            });
        }

        // Find tenant with valid token
        const tenant = await prisma.tenant.findFirst({
            where: {
                passwordResetToken: token,
                passwordResetExpires: {
                    gt: new Date() // Token not expired
                }
            }
        });

        if (!tenant) {
            return res.status(400).json({
                success: false,
                error: 'Invalid or expired reset link'
            });
        }

        // Hash new password
        const passwordHash = await bcrypt.hash(newPassword, 10);

        // Update password and clear reset token
        await prisma.tenant.update({
            where: { id: tenant.id },
            data: {
                passwordHash,
                passwordResetToken: null,
                passwordResetExpires: null
            }
        });

        // Audit Log
        await prisma.auditLog.create({
            data: {
                tenantId: tenant.id,
                action: 'PASSWORD_RESET',
                entity: 'Auth',
                performedBy: tenant.email
            }
        });

        logger.info(`Password reset successful for ${tenant.email}`);

        res.json({
            success: true,
            message: 'Password reset successfully! You can now login with your new password.'
        });
    } catch (error: any) {
        logger.error(`Reset password error: ${error.message}`);
        res.status(500).json({ error: 'Failed to reset password' });
    }
});


export default router;
