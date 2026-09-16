import 'dotenv/config';

export type ConfiguredAgentMode = 'auto' | 'live' | 'demo';
export type ConfiguredAgentProvider = 'auto' | 'openai' | 'gemini';

function readMode(value: string | undefined): ConfiguredAgentMode {
  return value === 'live' || value === 'demo' ? value : 'auto';
}

function readProvider(value: string | undefined): ConfiguredAgentProvider {
  return value === 'openai' || value === 'gemini' ? value : 'auto';
}

export const env = {
  port: Number(process.env['PORT'] ?? 3000),
  agentMode: readMode(process.env['AGENT_MODE']),
  agentProvider: readProvider(process.env['AGENT_PROVIDER']),
  openAiApiKey: process.env['OPENAI_API_KEY'],
  openAiModel: process.env['OPENAI_MODEL'] ?? 'gpt-5-mini',
  geminiApiKey: process.env['GEMINI_API_KEY'],
  geminiModel: process.env['GEMINI_MODEL'] ?? 'gemini-3.6-flash',
  stepDelayMs: Number(process.env['DEMO_STEP_DELAY_MS'] ?? 260),
};
