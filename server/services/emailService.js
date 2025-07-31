const brevo = require('@getbrevo/brevo');
const path = require('path');
const fs = require('fs').promises;

class EmailService {
  constructor() {
    // Initialize Brevo API
    this.apiInstance = new brevo.TransactionalEmailsApi();
    this.apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);
    
    this.senderEmail = process.env.SENDER_EMAIL || 'noreply@budgetlens.com';
    this.senderName = 'BudgetLens';
  }

  /**
   * Send HTML email using Brevo
   */
  async sendHtmlEmail(recipientEmail, recipientName, subject, htmlContent) {
    try {
      
      const sendSmtpEmail = new brevo.SendSmtpEmail();
      
      sendSmtpEmail.sender = {
        email: this.senderEmail,
        name: this.senderName
      };
      
      sendSmtpEmail.to = [{
        email: recipientEmail,
        name: recipientName || ''
      }];
      
      sendSmtpEmail.subject = subject;
      sendSmtpEmail.htmlContent = htmlContent;

      console.log(`📧 Sending email to ${recipientEmail} with subject: ${subject}`);
      const result = await this.apiInstance.sendTransacEmail(sendSmtpEmail);
      console.log('✅ Email sent successfully:', result.body?.messageId || result.messageId);
      
      return {
        success: true,
        messageId: result.body?.messageId || result.messageId
      };
    } catch (error) {
      console.error('❌ DETAILED ERROR sending email:');
      console.error('❌ Error name:', error.name);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error status:', error.status);
      console.error('❌ Error response:', error.response?.data || error.response);
      console.error('❌ Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      
      return {
        success: false,
        error: error.message,
        details: {
          name: error.name,
          status: error.status,
          response: error.response?.data || error.response
        }
      };
    }
  }

  /**
   * Load email template from file and replace variables
   */
  async loadTemplate(templateName, variables = {}) {
    try {
      const templatePath = path.join(__dirname, '../templates/emails', `${templateName}.html`);
      let htmlContent = await fs.readFile(templatePath, 'utf8');
      
      // Replace variables in template
      Object.keys(variables).forEach(key => {
        const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
        htmlContent = htmlContent.replace(regex, variables[key]);
      });
      
      return htmlContent;
    } catch (error) {
      console.error(`❌ Error loading template ${templateName}:`, error);
      throw new Error(`Failed to load email template: ${templateName}`);
    }
  }

  /**
   * Send welcome email after registration
   */
  async sendWelcomeEmail(user) {
    try {
      const htmlContent = await this.loadTemplate('welcome', {
        user_name: user.first_name || user.username,
        user_email: user.email,
        login_url: `${process.env.FRONTEND_URL || 'http://localhost:4000'}/login`
      });

      return await this.sendHtmlEmail(
        user.email,
        `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username,
        'ברוכים הבאים ל-BudgetLens! 🎉',
        htmlContent
      );
    } catch (error) {
      console.error('❌ Error sending welcome email:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send email verification email
   */
  async sendVerificationEmail(user, verificationToken) {
    try {
      const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:4000'}/verify-email?token=${verificationToken}`;
      
      const htmlContent = await this.loadTemplate('email_verification', {
        user_name: user.first_name || user.username,
        verification_url: verificationUrl,
        user_email: user.email
      });

      return await this.sendHtmlEmail(
        user.email,
        `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username,
        'אימות כתובת המייל שלך - BudgetLens ✉️',
        htmlContent
      );
    } catch (error) {
      console.error('❌ Error sending verification email:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(user, resetToken) {
    try {
      const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:4000'}/reset-password?token=${resetToken}`;
      
      const htmlContent = await this.loadTemplate('password_reset', {
        user_name: user.first_name || user.username,
        reset_url: resetUrl,
        user_email: user.email,
        expiry_time: '60 דקות'
      });

      return await this.sendHtmlEmail(
        user.email,
        `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username,
        'איפוס סיסמה - BudgetLens 🔐',
        htmlContent
      );
    } catch (error) {
      console.error('❌ Error sending password reset email:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send password change confirmation email
   */
  async sendPasswordChangeConfirmation(user) {
    try {
      const htmlContent = await this.loadTemplate('password_changed', {
        user_name: user.first_name || user.username,
        user_email: user.email,
        change_time: new Date().toLocaleString('he-IL'),
        support_email: this.senderEmail
      });

      return await this.sendHtmlEmail(
        user.email,
        `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username,
        'הסיסמה שלך שונתה בהצלחה - BudgetLens ✅',
        htmlContent
      );
    } catch (error) {
      console.error('❌ Error sending password change confirmation:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send email change verification
   */
  async sendEmailChangeVerification(user, newEmail, verificationToken) {
    try {
      const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:4000'}/verify-email-change?token=${verificationToken}`;
      
      const htmlContent = await this.loadTemplate('email_change_verification', {
        user_name: user.first_name || user.username,
        old_email: user.email,
        new_email: newEmail,
        verification_url: verificationUrl
      });

      return await this.sendHtmlEmail(
        newEmail,
        `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username,
        'אימות שינוי כתובת מייל - BudgetLens 📧',
        htmlContent
      );
    } catch (error) {
      console.error('❌ Error sending email change verification:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Test email service connection
   */
  async testConnection() {
    try {
      // Send a test email to verify the connection
      const testResult = await this.sendHtmlEmail(
        this.senderEmail,
        'Test',
        'BudgetLens Email Service Test',
        '<h1>Email service is working correctly!</h1><p>This is a test email from BudgetLens.</p>'
      );
      return testResult.success;
    } catch (error) {
      console.error('❌ Email service connection test failed:', error);
      return false;
    }
  }
}

module.exports = EmailService;