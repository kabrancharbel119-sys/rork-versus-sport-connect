import { Resend } from 'resend';

let resendClient: Resend | null = null;
let lastRateLimitTime: number = 0;
const RATE_LIMIT_COOLDOWN = 60000; // 1 minute cooldown after rate limit

function getResendClient(): Resend | null {
  if (resendClient) return resendClient;
  
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('[Email] RESEND_API_KEY is not set!');
    return null;
  }
  
  try {
    resendClient = new Resend(apiKey);
    console.log('[Email] Resend client initialized successfully');
    return resendClient;
  } catch (e) {
    console.error('[Email] Failed to initialize Resend:', e);
    return null;
  }
}

function isRateLimited(): boolean {
  if (lastRateLimitTime === 0) return false;
  const elapsed = Date.now() - lastRateLimitTime;
  if (elapsed < RATE_LIMIT_COOLDOWN) {
    console.log(`[Email] Rate limited - ${Math.ceil((RATE_LIMIT_COOLDOWN - elapsed) / 1000)}s remaining`);
    return true;
  }
  return false;
}

const FROM_EMAIL = 'VS App <onboarding@resend.dev>';

// NOTE: With onboarding@resend.dev, you can ONLY send to the email registered with your Resend account
// Once your domain (versus.com) is verified, change this to: 'VS App <noreply@versus.com>'

export async function sendPasswordResetEmail(to: string, code: string, userName: string): Promise<boolean> {
  console.log(`[Email] Sending password reset email to ${to}`);
  
  if (isRateLimited()) {
    console.log('[Email] Skipping - rate limited');
    return false;
  }
  
  const client = getResendClient();
  if (!client) {
    console.error('[Email] Resend client not available');
    return false;
  }
  
  try {
    const { data, error } = await client.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: 'Réinitialisation de votre mot de passe - VS App',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; background-color: #0A0F1A; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0A0F1A; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #111827; border-radius: 16px; overflow: hidden;">
                  <tr>
                    <td style="padding: 40px 40px 30px; text-align: center; background: linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%);">
                      <h1 style="margin: 0; color: #FFFFFF; font-size: 28px; font-weight: 700;">VS App</h1>
                      <p style="margin: 10px 0 0; color: rgba(255,255,255,0.8); font-size: 14px;">Votre application sportive</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 40px;">
                      <h2 style="margin: 0 0 16px; color: #FFFFFF; font-size: 22px; font-weight: 600;">Bonjour ${userName},</h2>
                      <p style="margin: 0 0 24px; color: #9CA3AF; font-size: 15px; line-height: 24px;">
                        Vous avez demandé la réinitialisation de votre mot de passe. Utilisez le code ci-dessous pour continuer :
                      </p>
                      <div style="background-color: #1F2937; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
                        <span style="font-size: 36px; font-weight: 700; color: #3B82F6; letter-spacing: 8px;">${code}</span>
                      </div>
                      <p style="margin: 0 0 8px; color: #9CA3AF; font-size: 14px; line-height: 22px;">
                        Ce code expire dans <strong style="color: #FFFFFF;">15 minutes</strong>.
                      </p>
                      <p style="margin: 0; color: #6B7280; font-size: 13px; line-height: 20px;">
                        Si vous n'avez pas demandé cette réinitialisation, ignorez simplement cet email.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 24px 40px; background-color: #0D1117; border-top: 1px solid #1F2937;">
                      <p style="margin: 0; color: #6B7280; font-size: 12px; text-align: center;">
                        © 2024 VS App. Tous droits réservés.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error('[Email] Failed to send password reset email:', error);
      if (error.message?.includes('rate') || error.name === 'rate_limit_exceeded') {
        lastRateLimitTime = Date.now();
      }
      return false;
    }

    console.log('[Email] Password reset email sent successfully:', data?.id);
    return true;
  } catch (error: any) {
    console.error('[Email] Error sending password reset email:', error);
    if (error?.statusCode === 429 || error?.message?.includes('rate')) {
      lastRateLimitTime = Date.now();
    }
    return false;
  }
}

export async function sendVerificationEmail(to: string, code: string, userName: string): Promise<boolean> {
  console.log(`[Email] ========================================`);
  console.log(`[Email] Sending verification email`);
  console.log(`[Email] To: ${to}`);
  console.log(`[Email] From: ${FROM_EMAIL}`);
  console.log(`[Email] Code: ${code}`);
  console.log(`[Email] User: ${userName}`);
  
  if (isRateLimited()) {
    console.log('[Email] Skipping - rate limited');
    return false;
  }
  
  const client = getResendClient();
  if (!client) {
    console.error('[Email] Resend client not available');
    return false;
  }
  
  try {
    const { data, error } = await client.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: 'Vérifiez votre email - VS App',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; background-color: #0A0F1A; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0A0F1A; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #111827; border-radius: 16px; overflow: hidden;">
                  <tr>
                    <td style="padding: 40px 40px 30px; text-align: center; background: linear-gradient(135deg, #10B981 0%, #059669 100%);">
                      <h1 style="margin: 0; color: #FFFFFF; font-size: 28px; font-weight: 700;">VS App</h1>
                      <p style="margin: 10px 0 0; color: rgba(255,255,255,0.8); font-size: 14px;">Bienvenue dans la communauté !</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 40px;">
                      <h2 style="margin: 0 0 16px; color: #FFFFFF; font-size: 22px; font-weight: 600;">Bienvenue ${userName} !</h2>
                      <p style="margin: 0 0 24px; color: #9CA3AF; font-size: 15px; line-height: 24px;">
                        Merci de vous être inscrit sur VS App ! Pour activer votre compte, veuillez entrer le code de vérification ci-dessous :
                      </p>
                      <div style="background-color: #1F2937; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
                        <span style="font-size: 36px; font-weight: 700; color: #10B981; letter-spacing: 8px;">${code}</span>
                      </div>
                      <p style="margin: 0 0 8px; color: #9CA3AF; font-size: 14px; line-height: 22px;">
                        Ce code expire dans <strong style="color: #FFFFFF;">30 minutes</strong>.
                      </p>
                      <p style="margin: 0; color: #6B7280; font-size: 13px; line-height: 20px;">
                        Si vous n'avez pas créé de compte, ignorez simplement cet email.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 24px 40px; background-color: #0D1117; border-top: 1px solid #1F2937;">
                      <p style="margin: 0; color: #6B7280; font-size: 12px; text-align: center;">
                        © 2024 VS App. Tous droits réservés.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error('[Email] ❌ Failed to send verification email');
      console.error('[Email] Error name:', error.name);
      console.error('[Email] Error message:', error.message);
      console.error('[Email] Full error:', JSON.stringify(error, null, 2));
      if (error.message?.includes('rate') || error.name === 'rate_limit_exceeded') {
        lastRateLimitTime = Date.now();
      }
      return false;
    }

    console.log('[Email] ✅ Verification email sent successfully!');
    console.log('[Email] Email ID:', data?.id);
    console.log(`[Email] ========================================`);
    return true;
  } catch (error: any) {
    console.error('[Email] ❌ Exception sending verification email');
    console.error('[Email] Error:', error?.message || error);
    console.error('[Email] Stack:', error?.stack);
    if (error?.statusCode === 429 || error?.message?.includes('rate')) {
      lastRateLimitTime = Date.now();
    }
    return false;
  }
}

export async function sendWelcomeEmail(to: string, userName: string): Promise<boolean> {
  console.log(`[Email] Sending welcome email to ${to}`);
  
  if (isRateLimited()) {
    console.log('[Email] Skipping welcome email - rate limited');
    return false;
  }
  
  const client = getResendClient();
  if (!client) {
    console.error('[Email] Resend client not available');
    return false;
  }
  
  try {
    const { data, error } = await client.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: 'Bienvenue sur VS App !',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; background-color: #0A0F1A; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0A0F1A; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #111827; border-radius: 16px; overflow: hidden;">
                  <tr>
                    <td style="padding: 40px 40px 30px; text-align: center; background: linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%);">
                      <h1 style="margin: 0; color: #FFFFFF; font-size: 28px; font-weight: 700;">Bienvenue sur VS App !</h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 40px;">
                      <h2 style="margin: 0 0 16px; color: #FFFFFF; font-size: 22px; font-weight: 600;">Salut ${userName} !</h2>
                      <p style="margin: 0 0 24px; color: #9CA3AF; font-size: 15px; line-height: 24px;">
                        Votre compte est maintenant actif. Voici ce que vous pouvez faire :
                      </p>
                      <div style="margin-bottom: 16px; padding: 16px; background-color: #1F2937; border-radius: 8px;">
                        <p style="margin: 0; color: #FFFFFF; font-size: 14px;">Trouver des matchs pres de chez vous</p>
                      </div>
                      <div style="margin-bottom: 16px; padding: 16px; background-color: #1F2937; border-radius: 8px;">
                        <p style="margin: 0; color: #FFFFFF; font-size: 14px;">Creer ou rejoindre une equipe</p>
                      </div>
                      <div style="margin-bottom: 16px; padding: 16px; background-color: #1F2937; border-radius: 8px;">
                        <p style="margin: 0; color: #FFFFFF; font-size: 14px;">Participer a des tournois et gagner des trophees</p>
                      </div>
                      <div style="padding: 16px; background-color: #1F2937; border-radius: 8px;">
                        <p style="margin: 0; color: #FFFFFF; font-size: 14px;">Suivre vos statistiques et progresser</p>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 24px 40px; background-color: #0D1117; border-top: 1px solid #1F2937;">
                      <p style="margin: 0; color: #6B7280; font-size: 12px; text-align: center;">
                        © 2024 VS App. Tous droits reserves.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error('[Email] Failed to send welcome email:', error);
      if (error.message?.includes('rate') || error.name === 'rate_limit_exceeded') {
        lastRateLimitTime = Date.now();
      }
      return false;
    }

    console.log('[Email] Welcome email sent successfully:', data?.id);
    return true;
  } catch (error: any) {
    console.error('[Email] Error sending welcome email:', error);
    if (error?.statusCode === 429 || error?.message?.includes('rate')) {
      lastRateLimitTime = Date.now();
    }
    return false;
  }
}
