require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function testSimple() {
    console.log("1. Checking API Key...");
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
        console.error("❌ No API Key found in .env");
        return;
    }
    console.log(`   Key found: ${key.substring(0, 10)}...`);

    console.log("2. Initializing Gemini Client...");
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    console.log("3. Sending Simple Prompt...");
    try {
        const result = await model.generateContent("Explain 'Hello World' in 1 sentence.");
        const response = await result.response;
        const text = response.text();
        console.log("✅ SUCCESS! Real AI Response:");
        console.log("------------------------------------------------");
        console.log(text);
        console.log("------------------------------------------------");
    } catch (error) {
        console.error("❌ AI CALLED FAILED:");
        console.error(error);
    }
}

testSimple();
