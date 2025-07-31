const crypto = require('crypto');
const jwt = require('jsonwebtoken');

class TokenService {
  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    this.passwordSalt = process.env.SECURITY_PASSWORD_SALT || 'default-salt';
  }

  /**
   * Generate a secure random token for email verification and password reset
   */
  generateSecureToken(data = {}) {
    const timestamp = Date.now();
    const randomBytes = crypto.randomBytes(32).toString('hex');
    
    // Combine timestamp, random bytes, and optional data
    const tokenData = {
      timestamp,
      random: randomBytes,
      ...data
    };
    
    // Create HMAC signature
    const hmac = crypto.createHmac('sha256', this.passwordSalt);
    hmac.update(JSON.stringify(tokenData));
    const signature = hmac.digest('hex');
    
    // Combine data and signature
    const token = Buffer.from(JSON.stringify({
      data: tokenData,
      signature
    })).toString('base64url');
    
    return token;
  }

  /**
   * Verify and decode a secure token
   */
  verifySecureToken(token, maxAge = 3600000) { // Default 1 hour
    try {
      // Decode token
      const decoded = JSON.parse(Buffer.from(token, 'base64url').toString());
      const { data, signature } = decoded;
      
      // Verify signature
      const hmac = crypto.createHmac('sha256', this.passwordSalt);
      hmac.update(JSON.stringify(data));
      const expectedSignature = hmac.digest('hex');
      
      if (signature !== expectedSignature) {
        throw new Error('Invalid token signature');
      }
      
      // Check expiration
      const now = Date.now();
      const tokenAge = now - data.timestamp;
      
      if (tokenAge > maxAge) {
        throw new Error('Token expired');
      }
      
      return {
        valid: true,
        data: data,
        age: tokenAge
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Generate email verification token
   */
  generateEmailVerificationToken(email, userId) {
    return this.generateSecureToken({
      type: 'email_verification',
      email,
      userId
    });
  }

  /**
   * Verify email verification token
   */
  verifyEmailVerificationToken(token) {
    const result = this.verifySecureToken(token, 24 * 60 * 60 * 1000); // 24 hours
    
    if (!result.valid) {
      return result;
    }
    
    if (result.data.type !== 'email_verification') {
      return {
        valid: false,
        error: 'Invalid token type'
      };
    }
    
    return {
      valid: true,
      email: result.data.email,
      userId: result.data.userId
    };
  }

  /**
   * Generate password reset token
   */
  generatePasswordResetToken(email, userId) {
    return this.generateSecureToken({
      type: 'password_reset',
      email,
      userId
    });
  }

  /**
   * Verify password reset token
   */
  verifyPasswordResetToken(token) {
    const result = this.verifySecureToken(token, 60 * 60 * 1000); // 1 hour
    
    if (!result.valid) {
      return result;
    }
    
    if (result.data.type !== 'password_reset') {
      return {
        valid: false,
        error: 'Invalid token type'
      };
    }
    
    return {
      valid: true,
      email: result.data.email,
      userId: result.data.userId
    };
  }

  /**
   * Generate email change verification token
   */
  generateEmailChangeToken(userId, oldEmail, newEmail) {
    return this.generateSecureToken({
      type: 'email_change',
      userId,
      oldEmail,
      newEmail
    });
  }

  /**
   * Verify email change token
   */
  verifyEmailChangeToken(token) {
    const result = this.verifySecureToken(token, 24 * 60 * 60 * 1000); // 24 hours
    
    if (!result.valid) {
      return result;
    }
    
    if (result.data.type !== 'email_change') {
      return {
        valid: false,
        error: 'Invalid token type'
      };
    }
    
    return {
      valid: true,
      userId: result.data.userId,
      oldEmail: result.data.oldEmail,
      newEmail: result.data.newEmail
    };
  }

  /**
   * Generate JWT token for authentication
   */
  generateJWT(user, expiresIn = '24h') {
    return jwt.sign(
      {
        userId: user.id,
        username: user.username,
        email: user.email
      },
      this.jwtSecret,
      { expiresIn }
    );
  }

  /**
   * Verify JWT token
   */
  verifyJWT(token) {
    try {
      const decoded = jwt.verify(token, this.jwtSecret);
      return {
        valid: true,
        data: decoded
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Generate a simple verification code (6 digits)
   */
  generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Hash a verification code for storage
   */
  hashVerificationCode(code, userId) {
    const hmac = crypto.createHmac('sha256', this.passwordSalt);
    hmac.update(`${code}:${userId}:${Date.now()}`);
    return hmac.digest('hex');
  }

  /**
   * Verify a verification code
   */
  verifyVerificationCode(code, hashedCode, userId) {
    const hmac = crypto.createHmac('sha256', this.passwordSalt);
    hmac.update(`${code}:${userId}`);
    const expectedHash = hmac.digest('hex');
    
    return hashedCode === expectedHash;
  }
}

module.exports = TokenService;