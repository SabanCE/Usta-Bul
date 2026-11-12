import nodemailer, { Transporter } from 'nodemailer';
import { AppError } from '../errors/AppError';

let transporter: Transporter | null = null;

const getTransporter = (): Transporter => {
  const user = process.env.SMTP_USER?.trim();
  const password = process.env.SMTP_PASS?.replace(/\s/g, '');
  const port = Number(process.env.SMTP_PORT || 587);

  if (!user || !password) {
    console.error('[Email] SMTP yapılandırması eksik:', {
      SMTP_USER: Boolean(user),
      SMTP_PASS: Boolean(password),
    });
    throw new AppError('E-posta gönderimi yapılandırılmamış. Lütfen daha sonra tekrar deneyin.', 503);
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error('[Email] SMTP_PORT geçersiz.');
    throw new AppError('E-posta sunucusu yapılandırması geçersiz.', 503);
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST?.trim() || 'smtp.gmail.com',
      port,
      secure: port === 465,
      auth: { user, pass: password },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
  }
  return transporter;
};

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character];
  });

export async function sendVerificationEmail(
  email: string,
  fullName: string,
  verificationUrl: string
): Promise<void> {
  const mailTransport = getTransporter();
  const user = process.env.SMTP_USER!.trim();
  const sender = process.env.SMTP_FROM?.trim() || `Usta Bul <${user}>`;
  const safeName = escapeHtml(fullName);
  const safeUrl = escapeHtml(verificationUrl);

  try {
    const result = await mailTransport.sendMail({
      from: sender,
      to: email,
      subject: 'Usta Bul e-posta adresinizi doğrulayın',
      text: `Merhaba ${fullName},\n\nUsta Bul hesabınızı doğrulamak için aşağıdaki bağlantıyı açın. Bağlantı 24 saat geçerlidir.\n\n${verificationUrl}\n\nBu isteği siz yapmadıysanız bu e-postayı yok sayabilirsiniz.`,
      html: `<!doctype html>
<html lang="tr">
  <body style="margin:0;padding:32px 16px;background:#f7f4eb;font-family:Arial,sans-serif;color:#172b3a">
    <div style="max-width:520px;margin:0 auto;padding:32px;border:1px solid #e6dfd0;border-radius:20px;background:#fffdf8">
      <div style="font-size:24px;font-weight:800;letter-spacing:-1px">🛠 Usta Bul</div>
      <h1 style="margin:28px 0 12px;font-size:23px">E-posta adresinizi doğrulayın</h1>
      <p style="line-height:1.6">Merhaba ${safeName}, hesabınızı etkinleştirmek için e-posta adresinizi doğrulayın.</p>
      <p style="margin:28px 0">
        <a href="${safeUrl}" style="display:inline-block;padding:13px 22px;border-radius:999px;background:#d4e85c;color:#172b3a;text-decoration:none;font-weight:700">E-posta adresimi doğrula</a>
      </p>
      <p style="color:#65747a;font-size:13px;line-height:1.6">Bağlantı 24 saat geçerlidir. Bu isteği siz yapmadıysanız e-postayı yok sayabilirsiniz.</p>
    </div>
  </body>
</html>`,
    });

    const accepted = (result.accepted ?? []).map(String);
    if (!accepted.some((recipient) => recipient.toLowerCase() === email.toLowerCase())) {
      throw new Error('SMTP sunucusu alıcı adresini kabul etmedi.');
    }

    console.info('[Email] SMTP doğrulama mesajını kabul etti:', {
      recipientDomain: email.split('@')[1] || 'unknown',
      messageId: result.messageId,
    });
  } catch (error) {
    console.error(
      '[Email] Doğrulama e-postası gönderilemedi:',
      error instanceof Error ? error.message : 'Bilinmeyen SMTP hatası',
      error && typeof error === 'object' && 'code' in error
        ? { code: (error as { code?: string }).code }
        : undefined
    );
    throw new AppError('Doğrulama e-postası gönderilemedi. Lütfen biraz sonra tekrar deneyin.', 503);
  }
}
