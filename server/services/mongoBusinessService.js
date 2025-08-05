const { MongoClient } = require('mongodb');

class MongoBusinessService {
  constructor() {
    this.client = null;
    this.db = null;
    this.collection = null;
  }

  async connect() {
    try {
      if (!this.client) {
        this.client = new MongoClient(process.env.MONGODB_URI);
        await this.client.connect();
        this.db = this.client.db(process.env.MONGODB_DB_NAME);
        this.collection = this.db.collection('business_intelligence');
        
        // Create indexes for better performance
        await this.collection.createIndex({ "business_name": 1, "user_id": 1 });
        await this.collection.createIndex({ "user_id": 1 });
        await this.collection.createIndex({ "updated_at": -1 });
        
        console.log('MongoDB Business Service connected successfully');
      }
      return true;
    } catch (error) {
      console.error('MongoDB Business Service connection error:', error);
      throw error;
    }
  }

  async disconnect() {
    try {
      if (this.client) {
        await this.client.close();
        this.client = null;
        this.db = null;
        this.collection = null;
        console.log('MongoDB Business Service disconnected');
      }
    } catch (error) {
      console.error('MongoDB disconnect error:', error);
    }
  }

  async saveBusinessIntelligence(userId, businessName, perplexityData) {
    try {
      await this.connect();

      const businessDoc = {
        user_id: userId,
        business_name: businessName,
        perplexity_analysis: {
          category: perplexityData.category || perplexityData.suggested_category,
          confidence: perplexityData.confidence || 0,
          reasoning: perplexityData.reasoning || '',
          business_info: perplexityData.business_info || {},
          debug_info: perplexityData.debug_info || null,
          raw_response: perplexityData.raw_response || null
        },
        analysis_date: new Date(),
        created_at: new Date(),
        updated_at: new Date()
      };

      // Upsert - update if exists, insert if new
      const result = await this.collection.replaceOne(
        { 
          user_id: userId, 
          business_name: businessName 
        },
        businessDoc,
        { upsert: true }
      );

      console.log(`Business intelligence saved for: ${businessName} (${result.upsertedCount ? 'inserted' : 'updated'})`);
      return {
        success: true,
        business_name: businessName,
        operation: result.upsertedCount ? 'inserted' : 'updated',
        id: result.upsertedId || result.matchedCount
      };

    } catch (error) {
      console.error('Error saving business intelligence:', error);
      throw error;
    }
  }

  async getBusinessIntelligence(userId, businessName = null) {
    try {
      await this.connect();

      const query = { user_id: userId };
      if (businessName) {
        query.business_name = businessName;
      }

      const businesses = await this.collection
        .find(query)
        .sort({ updated_at: -1 })
        .toArray();

      return {
        success: true,
        businesses: businesses
      };

    } catch (error) {
      console.error('Error getting business intelligence:', error);
      throw error;
    }
  }

  async updateBusinessIntelligence(userId, businessName, updateData) {
    try {
      await this.connect();

      const result = await this.collection.updateOne(
        { 
          user_id: userId, 
          business_name: businessName 
        },
        { 
          $set: {
            ...updateData,
            updated_at: new Date()
          }
        }
      );

      return {
        success: result.matchedCount > 0,
        modified: result.modifiedCount,
        business_name: businessName
      };

    } catch (error) {
      console.error('Error updating business intelligence:', error);
      throw error;
    }
  }

  async deleteBusinessIntelligence(userId, businessName) {
    try {
      await this.connect();

      const result = await this.collection.deleteOne({
        user_id: userId,
        business_name: businessName
      });

      return {
        success: result.deletedCount > 0,
        deleted: result.deletedCount,
        business_name: businessName
      };

    } catch (error) {
      console.error('Error deleting business intelligence:', error);
      throw error;
    }
  }

  async getAllBusinessesForUser(userId) {
    try {
      await this.connect();

      const businesses = await this.collection
        .find({ user_id: userId })
        .sort({ business_name: 1 })
        .toArray();

      return {
        success: true,
        count: businesses.length,
        businesses: businesses
      };

    } catch (error) {
      console.error('Error getting all businesses for user:', error);
      throw error;
    }
  }

  async searchBusinesses(userId, searchTerm) {
    try {
      await this.connect();

      const businesses = await this.collection
        .find({
          user_id: userId,
          $or: [
            { business_name: { $regex: searchTerm, $options: 'i' } },
            { 'perplexity_analysis.business_info.name': { $regex: searchTerm, $options: 'i' } },
            { 'perplexity_analysis.business_info.type': { $regex: searchTerm, $options: 'i' } }
          ]
        })
        .sort({ updated_at: -1 })
        .toArray();

      return {
        success: true,
        count: businesses.length,
        businesses: businesses
      };

    } catch (error) {
      console.error('Error searching businesses:', error);
      throw error;
    }
  }

  async getBusinessStats(userId) {
    try {
      await this.connect();

      const stats = await this.collection.aggregate([
        { $match: { user_id: userId } },
        {
          $group: {
            _id: null,
            total_businesses: { $sum: 1 },
            avg_confidence: { $avg: '$perplexity_analysis.confidence' },
            categories: { $addToSet: '$perplexity_analysis.category' },
            latest_analysis: { $max: '$analysis_date' },
            oldest_analysis: { $min: '$analysis_date' }
          }
        }
      ]).toArray();

      return {
        success: true,
        stats: stats[0] || {
          total_businesses: 0,
          avg_confidence: 0,
          categories: [],
          latest_analysis: null,
          oldest_analysis: null
        }
      };

    } catch (error) {
      console.error('Error getting business stats:', error);
      throw error;
    }
  }
}

// Export singleton instance
const mongoBusinessService = new MongoBusinessService();

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down MongoDB Business Service...');
  await mongoBusinessService.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down MongoDB Business Service...');
  await mongoBusinessService.disconnect();
  process.exit(0);
});

module.exports = mongoBusinessService;