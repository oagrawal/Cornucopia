const { GoogleGenAI } = require("@google/genai");
const db = require('../config/db');

// Initialize with API key directly
const genAI = new GoogleGenAI({ apiKey: "AIzaSyDV4jl7YN27V38CuQ8QBnHMCZ54Bo4atyw"});

// Store chat sessions
const chatSessions = new Map();

const chatController = {
    async getChatResponse(req, res) {
        try {
            const { message, sessionId } = req.body;
            
            // Get all ingredients from database
            const ingredientsResult = await db.query('SELECT * FROM ingredients');
            const ingredients = ingredientsResult.rows;
            
            // Create a context with available ingredients
            const ingredientsList = ingredients.map(ing => `${ing.name} (${ing.quantity} ${ing.category})`).join(', ');
            
            // Get or create chat session
            let chat;
            if (!chatSessions.has(sessionId)) {
                chat = await genAI.chats.create({
                    model: "gemini-2.0-flash",
                    history: [
                        {
                            role: "user",
                            parts: [{ text: "Hello" }],
                        },
                        {
                            role: "model",
                            parts: [{ text: `You are a helpful recipe assistant. The user has these ingredients available in their fridge: ${ingredientsList}. Help them find recipes and answer questions about cooking with these ingredients.` }],
                        },
                    ],
                });
                chatSessions.set(sessionId, chat);
            } else {
                chat = chatSessions.get(sessionId);
            }
            
            // Send message and get response
            const stream = await chat.sendMessageStream({
                message: message
            });
            
            let fullResponse = '';
            for await (const chunk of stream) {
                fullResponse += chunk.text;
            }
            
            res.json({ 
                success: true, 
                response: fullResponse 
            });
        } catch (error) {
            console.error('Error in chat controller:', error);
            res.status(500).json({ 
                success: false, 
                error: 'Failed to process chat request' 
            });
        }
    }
};

module.exports = chatController; 