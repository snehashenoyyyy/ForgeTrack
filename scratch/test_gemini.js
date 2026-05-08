import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';
dotenv.config({ path: 'frontend/.env.local' });

async function testGemini() {
  const apiKey = process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    console.error("No API Key found");
    return;
  }
  
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  
  try {
    const result = await model.generateContent("Say hello");
    console.log("Gemini Response:", result.response.text());
  } catch (error) {
    console.error("Gemini Error:", error.message);
  }
}

testGemini();
