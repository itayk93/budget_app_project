const { MongoClient } = require('mongodb');
require('dotenv').config();

class MongoService {
    constructor() {
        this.client = null;
        this.db = null;
        this.uri = process.env.MONGODB_URI;
        this.dbName = process.env.MONGODB_DB_NAME || 'budget_app';
    }

    async connect() {
        try {
            if (!this.uri) {
                throw new Error('MongoDB URI not found in environment variables');
            }

            this.client = new MongoClient(this.uri);
            await this.client.connect();
            this.db = this.client.db(this.dbName);
            
            console.log('Successfully connected to MongoDB Atlas');
            return true;
        } catch (error) {
            console.error('MongoDB connection error:', error);
            throw error;
        }
    }

    async testConnection() {
        try {
            await this.connect();
            
            // Test connection by pinging the database
            await this.db.admin().ping();
            console.log('MongoDB ping successful');

            // Add a test document to verify write operations
            const testCollection = this.db.collection('test');
            const testDoc = {
                message: 'MongoDB connection test successful!',
                timestamp: new Date(),
                environment: process.env.NODE_ENV || 'development'
            };

            const result = await testCollection.insertOne(testDoc);
            console.log('Test document inserted with ID:', result.insertedId);

            // Retrieve the test document
            const retrieved = await testCollection.findOne({ _id: result.insertedId });
            console.log('Retrieved test document:', retrieved);

            return {
                success: true,
                message: 'MongoDB Atlas connection and operations successful',
                documentId: result.insertedId,
                document: retrieved
            };

        } catch (error) {
            console.error('MongoDB test failed:', error);
            return {
                success: false,
                error: error.message
            };
        } finally {
            if (this.client) {
                await this.client.close();
            }
        }
    }

    async disconnect() {
        if (this.client) {
            await this.client.close();
            console.log('Disconnected from MongoDB');
        }
    }
}

module.exports = new MongoService();