const { GoogleGenAI } = require("@google/genai");
const settings = require("./settings");

// Simple in-memory storage for conversation context
const conversationMemory = new Map();

/**
 * Get or initialize memory for a user
 */
function getUserMemory(userId) {
    if (!conversationMemory.has(userId)) {
        conversationMemory.set(userId, []);
    }
    return conversationMemory.get(userId);
}

/**
 * Add a message to user's memory
 */
function addToMemory(userId, role, text) {
    const memory = getUserMemory(userId);
    memory.push({ role, parts: [{ text }] });
    
    // Keep only the last N messages
    if (memory.length > settings.memoryLimit * 2) {
        memory.splice(0, memory.length - (settings.memoryLimit * 2));
    }
}

/**
 * Generate AI response using Gemini
 */
async function generateResponse(userId, userMessage) {
    try {
        if (!settings.aiApiKey) {
            return "Error: Gemini API Key is missing. Please configure it in settings.js or environment variables.";
        }

        const ai = new GoogleGenAI({ apiKey: settings.aiApiKey });
        const memory = getUserMemory(userId);
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: [...memory, { role: "user", parts: [{ text: userMessage }] }],
            config: {
                maxOutputTokens: settings.maxTokens,
                temperature: settings.temperature,
                systemInstruction: `You are ${settings.botName}, a friendly and helpful AI assistant on WhatsApp. 
                Keep your responses natural, concise, and helpful. 
                If the user asks for code, provide clean and well-commented code.
                Always respond in the same language as the user.`
            }
        });

        const aiText = response.text;
        
        // Update memory
        addToMemory(userId, "user", userMessage);
        addToMemory(userId, "model", aiText);
        
        return aiText;
    } catch (error) {
        console.error("AI Error:", error);
        return "Sorry, I encountered an error while processing your request. Please try again later.";
    }
}

/**
 * Detect message type for smart responses
 */
function detectMessageType(text) {
    const lowerText = text.toLowerCase();
    if (lowerText.match(/^(hi|hello|halo|p|oi|hey)/)) return "greeting";
    if (lowerText.includes("?") || lowerText.match(/^(what|how|why|when|where|who)/)) return "question";
    if (lowerText.includes("code") || lowerText.includes("function") || lowerText.includes("javascript") || lowerText.includes("python")) return "coding";
    return "casual";
}

module.exports = {
    generateResponse,
    detectMessageType
};
