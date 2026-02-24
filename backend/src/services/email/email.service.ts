/**
 * Email Service
 * Handles sending transactional emails (verification, welcome, etc.)
 */

import nodemailer from 'nodemailer';
import logger from '../../lib/logger.js';

const SMTP_CONFIG = {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
    }
};

const FROM_EMAIL = process.env.SMTP_FROM || 'noreply@salestra.com';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3001';

// Create reusable transporter
const transporter = nodemailer.createTransport(SMTP_CONFIG);

// Verify SMTP connection on startup
transporter.verify((error, success) => {
    if (error) {
        logger.warn(`SMTP connection failed: ${error.message}`);
        logger.warn('Email sending will fail. Please check SMTP configuration.');
    } else {
        logger.info('✅ Email service ready');
    }
});

/**
 * Send email verification link to user
 */
export async function sendVerificationEmail(email: string, token: string, businessName?: string) {
    const verifyUrl = `${FRONTEND_URL}/verify-email?token=${token}`;

    try {
        await transporter.sendMail({
            from: `"Salestra" <${FROM_EMAIL}>`,
            to: email,
            subject: 'Verify your Salestra account',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                </head>
                <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
                        <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to Salestra! 🎉</h1>
                    </div>
                    
                    <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
                        <p style="font-size: 16px; margin-bottom: 20px;">
                            ${businessName ? `Hi ${businessName} team,` : 'Hi there,'}
                        </p>
                        
                        <p style="font-size: 16px; margin-bottom: 20px;">
                            Thanks for signing up! Please verify your email address to complete your registration and access your dashboard.
                        </p>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${verifyUrl}" style="display: inline-block; padding: 14px 32px; background: #10b981; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                                Verify Email Address
                            </a>
                        </div>
                        
                        <p style="font-size: 14px; color: #666; margin-top: 30px;">
                            This link expires in <strong>24 hours</strong>. If you didn't create an account, you can safely ignore this email.
                        </p>
                        
                        <p style="font-size: 14px; color: #666; margin-top: 20px;">
                            Or copy this link into your browser:<br>
                            <span style="color: #10b981; word-break: break-all;">${verifyUrl}</span>
                        </p>
                    </div>
                    
                    <div style="text-align: center; margin-top: 30px; padding: 20px; color: #999; font-size: 12px;">
                        <p>Need help? Reply to this email or visit our support center.</p>
                        <p style="margin-top: 10px;">
                            © ${new Date().getFullYear()} Salestra. All rights reserved.
                        </p>
                    </div>
                </body>
                </html>
            `,
            text: `
Welcome to Salestra!

Please verify your email address by clicking the link below:
${verifyUrl}

This link expires in 24 hours.

If you didn't create an account, you can safely ignore this email.

Need help? Reply to this email.
            `.trim()
        });

        logger.info(`Verification email sent to ${email}`);
        return { success: true };
    } catch (error: any) {
        logger.error(`Failed to send verification email to ${email}: ${error.message}`);
        return { success: false, error: error.message };
    }
}

/**
 * Send welcome email after successful onboarding
 */
export async function sendWelcomeEmail(
    email: string,
    businessName: string,
    whatsappNumber?: string,
    trialEndDate?: Date
) {
    try {
        await transporter.sendMail({
            from: `"Salestra" <${FROM_EMAIL}>`,
            to: email,
            subject: '🎉 Your AI Employee is Live!',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                </head>
                <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                        <h1 style="color: white; margin: 0; font-size: 28px;">🚀 You're Live!</h1>
                    </div>
                    
                    <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
                        <p style="font-size: 16px;">Congratulations, <strong>${businessName}</strong>!</p>
                        
                        <p style="font-size: 16px;">Your AI employee is now live and handling WhatsApp conversations 24/7.</p>
                        
                        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
                            <h3 style="margin-top: 0; color: #10b981;">Setup Summary</h3>
                            <ul style="list-style: none; padding: 0;">
                                ${whatsappNumber ? `<li style="padding: 8px 0;">📱 <strong>WhatsApp:</strong> ${whatsappNumber}</li>` : ''}
                                <li style="padding: 8px 0;">🏢 <strong>Business:</strong> ${businessName}</li>
                                ${trialEndDate ? `<li style="padding: 8px 0;">⏰ <strong>Trial ends:</strong> ${trialEndDate.toLocaleDateString()}</li>` : ''}
                            </ul>
                        </div>
                        
                        <h3 style="color: #10b981; margin-top: 30px;">Next Steps:</h3>
                        <ol style="padding-left: 20px;">
                            <li style="margin-bottom: 10px;">Send a test message to your WhatsApp number</li>
                            <li style="margin-bottom: 10px;">Upload more knowledge (FAQs, policies, product info)</li>
                            <li style="margin-bottom: 10px;">Review AI conversations in your dashboard</li>
                            <li style="margin-bottom: 10px;">Invite team members to collaborate</li>
                        </ol>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${FRONTEND_URL}/dashboard" style="display: inline-block; padding: 14px 32px; background: #10b981; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                                Go to Dashboard
                            </a>
                        </div>
                        
                        <p style="font-size: 14px; color: #666; margin-top: 30px;">
                            Need help? Reply to this email or visit our support center.
                        </p>
                    </div>
                    
                    <div style="text-align: center; margin-top: 30px; padding: 20px; color: #999; font-size: 12px;">
                        <p>© ${new Date().getFullYear()} Salestra. All rights reserved.</p>
                    </div>
                </body>
                </html>
            `
        });

        logger.info(`Welcome email sent to ${email}`);
        return { success: true };
    } catch (error: any) {
        logger.error(`Failed to send welcome email: ${error.message}`);
        return { success: false, error: error.message };
    }
}

/**
 * Resend verification email
 */
export async function resendVerificationEmail(email: string, token: string) {
    return sendVerificationEmail(email, token);
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(email: string, token: string) {
    const resetUrl = `${FRONTEND_URL}/reset-password?token=${token}`;

    try {
        await transporter.sendMail({
            from: `"Salestra" <${FROM_EMAIL}>`,
            to: email,
            subject: 'Reset your Salestra password',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                </head>
                <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
                        <h1 style="color: white; margin: 0; font-size: 28px;">🔐 Password Reset</h1>
                    </div>
                    
                    <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
                        <p style="font-size: 16px; margin-bottom: 20px;">
                            Hi there,
                        </p>
                        
                        <p style="font-size: 16px; margin-bottom: 20px;">
                            We received a request to reset your password for your Salestra account. Click the button below to create a new password.
                        </p>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${resetUrl}" style="display: inline-block; padding: 14px 32px; background: #3b82f6; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                                Reset Password
                            </a>
                        </div>
                        
                        <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; border-radius: 4px; margin: 20px 0;">
                            <p style="margin: 0; font-size: 14px; color: #92400e;">
                                <strong>⚠️ Important:</strong> This link expires in <strong>1 hour</strong> for security reasons.
                            </p>
                        </div>
                        
                        <p style="font-size: 14px; color: #666; margin-top: 30px;">
                            If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
                        </p>
                        
                        <p style="font-size: 14px; color: #666; margin-top: 20px;">
                            Or copy this link into your browser:<br>
                            <span style="color: #3b82f6; word-break: break-all;">${resetUrl}</span>
                        </p>
                    </div>
                    
                    <div style="text-align: center; margin-top: 30px; padding: 20px; color: #999; font-size: 12px;">
                        <p>Need help? Reply to this email or visit our support center.</p>
                        <p style="margin-top: 10px;">
                            © ${new Date().getFullYear()} Salestra. All rights reserved.
                        </p>
                    </div>
                </body>
                </html>
            `,
            text: `
Password Reset Request

We received a request to reset your password for your Salestra account.

Click the link below to reset your password:
${resetUrl}

This link expires in 1 hour for security reasons.

If you didn't request a password reset, you can safely ignore this email.

Need help? Reply to this email.
            `.trim()
        });

        logger.info(`Password reset email sent to ${email}`);
        return { success: true };
    } catch (error: any) {
        logger.error(`Failed to send password reset email to ${email}: ${error.message}`);
        return { success: false, error: error.message };
    }
}

export default {
    sendVerificationEmail,
    sendWelcomeEmail,
    resendVerificationEmail,
    sendPasswordResetEmail
};
