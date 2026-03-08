const settings = {
    ownerNumber: "628xxxxxxxxxx", // Your WhatsApp number with country code
    botName: "Gemini AI Assistant",
    aiApiKey: process.env.GEMINI_API_KEY || "", // Uses the platform's Gemini key
    autoReply: true,
    prefix: ".", // Optional prefix for commands if you add them later
    groupAiMode: true, // Enable AI in groups
    privateAiMode: true, // Enable AI in private chats
    cooldownTime: 3000, // 3 seconds cooldown between messages
    maxTokens: 500,
    temperature: 0.7,
    memoryLimit: 5 // Number of previous messages to remember for context
};

module.exports = settings;
