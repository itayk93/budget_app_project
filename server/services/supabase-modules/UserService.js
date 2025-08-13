/**
 * User Service for Supabase Operations
 * Extracted from supabaseService.js - User management operations
 * ~200 lines - Handles all user-related database operations
 */

const { adminClient } = require('../../config/supabase');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const SharedUtilities = require('./SharedUtilities');

class UserService {

  // ===== USER CREATION =====
  
  static async createUser(userData) {
    try {
      const { username, email, password, firstName, lastName } = userData;
      
      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);
      
      // Use admin client for user management operations (bypasses RLS)
      const { data, error } = await adminClient
        .from('users')
        .insert([{
          username,
          email,
          password_hash: passwordHash,
          first_name: firstName,
          last_name: lastName,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;
      return SharedUtilities.createSuccessResponse(data, 'User created successfully');
    } catch (error) {
      console.error('Failed to create user:', error);
      return SharedUtilities.handleSupabaseError(error, 'create user');
    }
  }

  // ===== USER RETRIEVAL =====

  static async getUserByEmail(email) {
    try {
      if (!email) {
        return SharedUtilities.createErrorResponse('Email is required');
      }

      // Use admin client for user management operations (bypasses RLS)
      const { data, error } = await adminClient
        .from('users')
        .select('*')
        .eq('email', email)
        .maybeSingle();

      if (error) throw error;
      return data ? SharedUtilities.createSuccessResponse(data) : null;
    } catch (error) {
      console.error(`Error fetching user by email ${email}:`, error);
      return SharedUtilities.handleSupabaseError(error, 'fetch user by email');
    }
  }

  static async getUserByUsername(username) {
    try {
      if (!username) {
        return SharedUtilities.createErrorResponse('Username is required');
      }

      // Use admin client for user management operations (bypasses RLS)
      const { data, error } = await adminClient
        .from('users')
        .select('*')
        .eq('username', username)
        .maybeSingle();

      if (error) throw error;
      return data ? SharedUtilities.createSuccessResponse(data) : null;
    } catch (error) {
      console.error(`Error fetching user by username ${username}:`, error);
      return SharedUtilities.handleSupabaseError(error, 'fetch user by username');
    }
  }

  static async getUserById(id) {
    try {
      // Validate UUID format
      if (!id || typeof id !== 'string') {
        console.error(`❌ Invalid user ID format: ${id} (type: ${typeof id})`);
        return SharedUtilities.createErrorResponse('Invalid user ID format');
      }
      
      // Basic UUID format check (36 characters with hyphens)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        console.error(`❌ Invalid UUID format for user ID: ${id}`);
        return SharedUtilities.createErrorResponse('Invalid UUID format');
      }

      console.log(`🔍 Looking up user with valid UUID: ${id}`);
      // Use admin client for user management operations (bypasses RLS)
      const { data, error } = await adminClient
        .from('users')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      
      console.log(`👤 User lookup result:`, data ? 'Found' : 'Not found');
      return data ? SharedUtilities.createSuccessResponse(data) : null;
    } catch (error) {
      console.error(`❌ Error fetching user by ID ${id}:`, error);
      return SharedUtilities.handleSupabaseError(error, 'fetch user by ID');
    }
  }

  // ===== USER UPDATES =====

  static async updateUserLastLogin(userId) {
    try {
      SharedUtilities.validateUserId(userId);

      const { error } = await supabase
        .from('users')
        .update({ 
          last_login: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) throw error;
      return SharedUtilities.createSuccessResponse(true, 'Last login updated successfully');
    } catch (error) {
      console.error('Failed to update last login:', error.message);
      return SharedUtilities.handleSupabaseError(error, 'update last login');
    }
  }

  static async updateUser(userId, updateData) {
    try {
      SharedUtilities.validateUserId(userId);

      if (updateData.password) {
        updateData.password_hash = await bcrypt.hash(updateData.password, 10);
        delete updateData.password;
      }
      
      updateData.updated_at = new Date().toISOString();
      
      // Use admin client for user management operations (bypasses RLS)
      const { data, error } = await adminClient
        .from('users')
        .update(updateData)
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;
      return SharedUtilities.createSuccessResponse(data, 'User updated successfully');
    } catch (error) {
      console.error(`Error updating user ${userId}:`, error);
      return SharedUtilities.handleSupabaseError(error, 'update user');
    }
  }

  // ===== PASSWORD VERIFICATION =====

  static async verifyPassword(plainPassword, hashedPassword) {
    try {
      if (!plainPassword || !hashedPassword) {
        return false;
      }

      // Check if it's a Flask/Werkzeug scrypt hash
      if (hashedPassword.startsWith('scrypt:')) {
        return await this.verifyFlaskPassword(plainPassword, hashedPassword);
      }
      
      // Otherwise use bcrypt
      return await bcrypt.compare(plainPassword, hashedPassword);
    } catch (error) {
      console.error('Password verification error:', error);
      return false;
    }
  }

  static async verifyFlaskPassword(plainPassword, hashedPassword) {
    // Flask/Werkzeug uses format: scrypt:32768:8:1$salt$hash
    try {
      console.log('🔍 Verifying Flask password format');
      console.log('   Hash:', hashedPassword.substring(0, 50) + '...');
      
      const parts = hashedPassword.split('$');
      if (parts.length !== 3) {
        console.log('❌ Invalid hash format - not 3 parts');
        return false;
      }
      
      const [method, salt, expectedHash] = parts;
      const [algorithm, N, r, p] = method.split(':');
      
      console.log('   Algorithm:', algorithm);
      console.log('   N:', N, 'r:', r, 'p:', p);
      console.log('   Salt:', salt);
      
      if (algorithm !== 'scrypt') {
        console.log('❌ Not scrypt algorithm');
        return false;
      }
      
      // Use exact parameters from Flask
      const scryptParams = {
        N: parseInt(N),
        r: parseInt(r), 
        p: parseInt(p),
        maxmem: 128 * 1024 * 1024 // 128MB memory limit
      };
      
      console.log('   Using params:', scryptParams);
      
      // Generate hash with same parameters as Flask/Werkzeug
      const derivedKey = crypto.scryptSync(
        plainPassword,
        salt,
        64, // key length (Flask uses 64 bytes)
        scryptParams
      );
      
      const derivedHex = derivedKey.toString('hex');
      console.log('   Expected hash:', expectedHash.substring(0, 20) + '...');
      console.log('   Derived hash: ', derivedHex.substring(0, 20) + '...');
      console.log('   Match:', derivedHex === expectedHash ? 'YES' : 'NO');
      
      return derivedHex === expectedHash;
    } catch (error) {
      console.error('❌ Flask password verification error:', error.message);
      return false;
    }
  }

  // ===== USER VALIDATION UTILITIES =====

  static async validateUserExists(userId) {
    try {
      const userResult = await this.getUserById(userId);
      return userResult && userResult.success && userResult.data;
    } catch (error) {
      console.error('Error validating user existence:', error);
      return false;
    }
  }

  static async isEmailTaken(email, excludeUserId = null) {
    try {
      let query = supabase
        .from('users')
        .select('id')
        .eq('email', email);

      if (excludeUserId) {
        query = query.neq('id', excludeUserId);
      }

      const { data, error } = await query.maybeSingle();
      
      if (error) throw error;
      return !!data;
    } catch (error) {
      console.error('Error checking email availability:', error);
      return true; // Assume taken on error for safety
    }
  }

  static async isUsernameTaken(username, excludeUserId = null) {
    try {
      let query = supabase
        .from('users')
        .select('id')
        .eq('username', username);

      if (excludeUserId) {
        query = query.neq('id', excludeUserId);
      }

      const { data, error } = await query.maybeSingle();
      
      if (error) throw error;
      return !!data;
    } catch (error) {
      console.error('Error checking username availability:', error);
      return true; // Assume taken on error for safety
    }
  }
}

module.exports = UserService;