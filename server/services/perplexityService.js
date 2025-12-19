const axios = require('axios');

class PerplexityService {
    constructor() {
        this.apiKey = process.env.PERPLEXITY_API_KEY;
        this.baseUrl = 'https://api.perplexity.ai';
        this.model = 'llama-3.1-sonar-large-128k-online';
    }

    /**
     * Categorize a transaction based on business name and available categories using Perplexity API
     * @param {string} businessName - The name of the business/transaction description
     * @param {Array<string>} availableCategories - List of available category names
     * @returns {Promise<string|null>} - The matching category name or null if no match found
     */
    async categorizeTransaction(businessName, availableCategories) {
        if (!this.apiKey) {
            console.warn('⚠️ Perplexity API key is missing. Skipping smart categorization.');
            return null;
        }

        if (!businessName || !availableCategories || availableCategories.length === 0) {
            return null;
        }

        try {
            const categoriesList = availableCategories.join(', ');
            const prompt = `
            You are a smart financial assistant helping to categorize bank transactions.
            
            Business Name: "${businessName}"
            
            Available Categories:
            [${categoriesList}]
            
            Task:
            Analyze the Business Name and choose the MOST relevant category from the Available Categories list.
            If the business is clearly related to one of the categories, return ONLY that category name.
            If you are not sure or if the business doesn't fit any category well, return "HOVS_MISHTANOT" (which acts as a code for "Other/Variable Expenses").
            
            Rules:
            1. Return ONLY the category name exactly as it appears in the list.
            2. Do not add any explanation, punctuation, or extra text.
            3. If the business implies food/supermarket, choose the food/supermarket related category.
            4. If the business implies fuel/transport, choose the transport related category.
            5. If unclear, return "HOVS_MISHTANOT".
            `;

            console.log(`🤖 Asking Perplexity to categorize "${businessName}"...`);

            const response = await axios.post(
                `${this.baseUrl}/chat/completions`,
                {
                    model: this.model,
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a helpful financial assistant. You strictly output only the category name from the provided list, or "HOVS_MISHTANOT".'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    temperature: 0.1 // Low temperature for deterministic results
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json',
                        'User-Agent': 'BudgetApp/1.0'
                    },
                    timeout: 10000 // 10 second timeout
                }
            );

            const result = response.data?.choices?.[0]?.message?.content?.trim();

            console.log(`🤖 Perplexity suggested: "${result}" for "${businessName}"`);

            if (result === 'HOVS_MISHTANOT') {
                return null; // Fallback to default logic
            }

            // Verify the result is actually in our list (loose match to be safe)
            const exactMatch = availableCategories.find(c => c === result);
            if (exactMatch) {
                return exactMatch;
            }

            // Try case-insensitive/trimmed match
            const looseMatch = availableCategories.find(c => c.trim().toLowerCase() === result.trim().toLowerCase());
            if (looseMatch) {
                return looseMatch;
            }

            console.log(`⚠️ Perplexity returned "${result}" which is not in the categories list. Ignoring.`);
            return null;

        } catch (error) {
            console.error('❌ Error calling Perplexity API:', error.message);
            if (error.response) {
                console.error('API Response:', error.response.data);
            }
            return null;
        }
    }
}

module.exports = new PerplexityService();
