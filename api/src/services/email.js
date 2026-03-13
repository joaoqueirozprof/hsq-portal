/**
 * Email service - centralized email sending with templates
 * Uses nodemailer with Gmail SMTP
 */
const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this._transporter = null;
  }

  get transporter() {
    if (!this._transporter) {
      const smtpPass = process.env.SMTP_PASS;
      if (!smtpPass) {
        throw new Error('SMTP_PASS nao configurado');
      }

      this._transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false,
        auth: {
          user: process.env.SMTP_USER || 'jcarlosyes25@gmail.com',
          pass: smtpPass,
        },
        pool: true, // Use connection pooling
        maxConnections: 3,
        maxMessages: 50,
      });
    }
    return this._transporter;
  }

  get isConfigured() {
    return !!process.env.SMTP_PASS;
  }

  get fromAddress() {
    return `"HSQ Rastreamento" <${process.env.SMTP_USER || 'jcarlosyes25@gmail.com'}>`;
  }

  // Base HTML template wrapper
  _wrapHtml(content) {
    return `
      <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:20px;background:#ffffff;">
        <div style="text-align:center;margin-bottom:24px;padding:16px;background:linear-gradient(135deg,#0f172a,#1e3a5f);border-radius:12px;">
          <h2 style="color:#ffffff;margin:0;font-size:20px;">HSQ Rastreamento</h2>
          <p style="color:#94a3b8;margin:4px 0 0;font-size:12px;">Monitoramento Inteligente</p>
        </div>
        ${content}
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
        <p style="color:#94a3b8;font-size:11px;text-align:center;">
          HSQ Rastreamento &copy; ${new Date().getFullYear()} - Todos os direitos reservados
        </p>
      </div>
    `;
  }

  // Send password reset code email
  async sendResetCode(toEmail, clientName, code) {
    const html = this._wrapHtml(`
      <p style="color:#334155;">Ola <strong>${clientName}</strong>,</p>
      <p style="color:#334155;">Voce solicitou a recuperacao de senha. Use o codigo abaixo:</p>
      <div style="text-align:center;margin:24px 0;">
        <div style="display:inline-block;background:#f1f5f9;padding:16px 32px;border-radius:12px;font-size:32px;font-weight:bold;letter-spacing:8px;color:#1e293b;border:2px solid #e2e8f0;">
          ${code}
        </div>
      </div>
      <p style="color:#64748b;font-size:13px;">Este codigo expira em <strong>15 minutos</strong>.</p>
      <p style="color:#64748b;font-size:13px;">Se voce nao solicitou, ignore este email.</p>
    `);

    return this._send(toEmail, 'Codigo de Recuperacao de Senha - HSQ Rastreamento', html);
  }

  // Send welcome email to new client
  async sendWelcome(toEmail, clientName, document) {
    const html = this._wrapHtml(`
      <p style="color:#334155;">Ola <strong>${clientName}</strong>,</p>
      <p style="color:#334155;">Bem-vindo(a) ao HSQ Rastreamento! Sua conta foi criada com sucesso.</p>
      <div style="background:#f0fdf4;padding:16px;border-radius:8px;margin:16px 0;border-left:4px solid #22c55e;">
        <p style="margin:0;color:#166534;font-size:14px;"><strong>Para fazer seu primeiro acesso:</strong></p>
        <ul style="margin:8px 0;padding-left:20px;color:#334155;font-size:14px;">
          <li>Acesse <a href="https://hsqrastreamento.com.br" style="color:#2563eb;">hsqrastreamento.com.br</a></li>
          <li>Use seu CPF/CNPJ como usuario</li>
          <li>Use seu CPF/CNPJ (somente numeros) como senha inicial</li>
          <li>Voce sera solicitado a criar uma nova senha</li>
        </ul>
      </div>
      <p style="color:#64748b;font-size:13px;">Em caso de duvidas, entre em contato com o administrador.</p>
    `);

    return this._send(toEmail, 'Bem-vindo ao HSQ Rastreamento', html);
  }

  // Send account status change notification
  async sendAccountStatus(toEmail, clientName, isActive) {
    const statusText = isActive ? 'reativada' : 'desativada';
    const statusColor = isActive ? '#22c55e' : '#ef4444';
    const html = this._wrapHtml(`
      <p style="color:#334155;">Ola <strong>${clientName}</strong>,</p>
      <div style="text-align:center;margin:20px 0;">
        <span style="display:inline-block;background:${statusColor};color:white;padding:8px 24px;border-radius:20px;font-weight:bold;font-size:16px;">
          Conta ${statusText}
        </span>
      </div>
      <p style="color:#334155;">Sua conta no HSQ Rastreamento foi <strong>${statusText}</strong>.</p>
      ${isActive ? '<p style="color:#334155;">Voce ja pode acessar o sistema normalmente.</p>' : '<p style="color:#334155;">Para mais informacoes, entre em contato com o administrador.</p>'}
    `);

    return this._send(toEmail, `Conta ${statusText} - HSQ Rastreamento`, html);
  }

  // Internal send method with error handling
  async _send(to, subject, html) {
    try {
      const result = await this.transporter.sendMail({
        from: this.fromAddress,
        to,
        subject,
        html,
      });
      console.log(`[Email] Sent to ${to}: ${subject}`);
      return result;
    } catch (err) {
      console.error(`[Email] Failed to send to ${to}:`, err.message);
      return null;
    }
  }

  // Verify SMTP connection
  async verify() {
    try {
      await this.transporter.verify();
      console.log('[Email] SMTP connection verified');
      return true;
    } catch (err) {
      console.error('[Email] SMTP verification failed:', err.message);
      return false;
    }
  }
}

// Singleton instance
const emailService = new EmailService();
module.exports = emailService;
