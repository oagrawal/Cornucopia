const { GoogleGenAI } = require("@google/genai");
const db = require('../config/db');

// Initialize with API key directly
const genAI = new GoogleGenAI({ apiKey: "AIzaSyDV4jl7YN27V38CuQ8QBnHMCZ54Bo4atyw"});

// Store chat sessions with their models
const chatSessions = new Map();

const chatController = {
    async getChatResponse(req, res) {
        try {
            const { message, sessionId, model } = req.body;
            
            // Get all ingredients from database
            const ingredientsResult = await db.query('SELECT * FROM ingredients');
            const ingredients = ingredientsResult.rows;
            
            // Create a context with available ingredients
            const ingredientsList = ingredients.map(ing => `${ing.name} (${ing.quantity} ${ing.category})`).join(', ');
            
            // Get or create chat session
            let chat;
            const selectedModel = model || "gemini-2.0-flash-lite"; // Default to 2.0 Flash if no model specified

            // Check if we need to create a new chat session or if the model has changed
            const existingSession = chatSessions.get(sessionId);
            const needNewSession = !existingSession || 
                                 (existingSession.model !== selectedModel);

            if (needNewSession) {
                chat = await genAI.chats.create({
                    model: selectedModel,
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
                // Store both the chat instance and the model used
                chatSessions.set(sessionId, { chat, model: selectedModel });
            } else {
                chat = existingSession.chat;
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
                response: fullResponse,
                model: selectedModel // Return the model being used
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