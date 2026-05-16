import 'dotenv/config';

export const models = {
    cloudflare: {
        apiKey: process.env.WORKER_AI.split(':')[1],
        baseURL: `https://api.cloudflare.com/client/v4/accounts/${process.env.WORKER_AI.split(':')[0]}/ai/v1`,
        kimi: {
            model: "@cf/moonshotai/kimi-k2.6",
        }
    },
    nvidia: {
        apiKey: process.env.NVIDIA_API_KEY,
        baseURL: 'https://integrate.api.nvidia.com/v1',
        minimax: {
            model: "minimaxai/minimax-m2.7",
            temperature: 1,
            top_p: 0.95,
        },
        kimi: {
            model: "moonshotai/kimi-k2.6",
            temperature: 1,
            top_p: 0.95,
            chat_template_kwargs: { "thinking": true },
        },
        glm: {
            model: "z-ai/glm-5.1",
            temperature: 1,
            top_p: 1,
            extra_body: {
                "chat_template_kwargs": { "enable_thinking": true, "clear_thinking": false }
            }
        }

    },
    alibaba: {
        apiKey: process.env.ALIBABA_API_KEY,
        baseURL: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
        qwen: {
            model: "qwen3.6-max-preview",
            extra_body: { "enable_thinking": true }
        }
    }
};