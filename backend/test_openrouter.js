const OpenAI = require("openai");
require('dotenv').config();

const openrouter = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY,
});

async function testOpenRouter() {
    const models = [
        "google/gemini-2.0-flash-exp:free",
        "google/gemma-3-27b-it:free",
        "meta-llama/llama-3.3-70b-instruct:free",
        "deepseek/deepseek-chat:free",
        "mistralai/mistral-7b-instruct:free",
    ];

    console.log("Testing OpenRouter models...");
    
    for (const model of models) {
        try {
            console.log(`Trying ${model}...`);
            const completion = await openrouter.chat.completions.create({
                model: model,
                messages: [{ role: "user", content: "Say hello" }],
                max_tokens: 10,
            });
            console.log(`✅ Success: ${completion.choices[0].message.content}`);
        } catch (err) {
            console.error(`❌ Failed ${model}: ${err.message}`);
        }
    }
}

testOpenRouter();
