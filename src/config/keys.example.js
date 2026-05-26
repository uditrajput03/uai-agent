// ============================================================
// API KEYS CONFIGURATION
// ============================================================
// 1. Copy this file to keys.js:    cp config/keys.example.js config/keys.js
// 2. Replace placeholder values with your actual API keys.
// 3. keys.js is gitignored — never commit real secrets!
// ============================================================

import 'dotenv/config';

export const keys = {
    // Cloudflare AI Worker — format: "account_id:api_token"
    WORKER_AI: process.env.WORKER_AI || "your-account-id:your-worker-api-token",

    // NVIDIA API — for GPU-hosted models (Kimi, GLM, MiniMax, etc.)
    NVIDIA_API_KEY: process.env.NVIDIA_API_KEY || "your-nvidia-api-key",

    // Alibaba Cloud / DashScope — for Qwen, DeepSeek models
    ALIBABA_API_KEY: process.env.ALIBABA_API_KEY || "your-alibaba-dashscope-api-key",

    // Z.AI — for GLM-4.7-Flash and other Z.AI models
    ZAI: process.env.ZAI || "your-zai-api-key",

    // OpenAI — for GPT models (or compatible proxy endpoints)
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || "your-openai-or-proxy-api-key",
    OPENAI_BASE_URL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",

    // Anthropic — for Claude models (Sonnet, Opus, Haiku)
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || "your-anthropic-api-key",

    // Google Gemini — for Gemini models (Flash, Pro)
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || "your-gemini-api-key",

    // Mistral — for Mistral models (Large, Medium, Small, Nemo)
    MISTRAL_API_KEY: process.env.MISTRAL_API_KEY || "your-mistral-api-key",

    // Groq — for fast inference (Llama, Mixtral, Gemma)
    GROQ_API_KEY: process.env.GROQ_API_KEY || "your-groq-api-key",

    // ---- Non-sensitive configuration ----

    DEBUG: true,                    // Enable debug logging
    showThinking: false,            // Show model thinking/reasoning output

    defaultProvider: "alibaba",     // Default provider when none specified
    defaultModel: "deepseekflash",  // Default model within that provider

    gitIgnoreUnsafePaths: true,     // Block tool calls on sensitive file paths

    // Redact these substrings from any output/logs for privacy/security
    REDACTION_PATTERN: ["placeholder"],
};
