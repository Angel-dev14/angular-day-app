import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import { z } from 'zod';
import { env, type ConfiguredAgentProvider } from '../config/env.js';

const appointmentPlanSchema = z.object({
  intent: z.enum(['conversation', 'show-appointment-details', 'reschedule-appointment']),
  patientQuery: z.string(),
  timeWindow: z.string(),
  reply: z.string(),
}).superRefine((plan, context) => {
  if (plan.intent !== 'conversation' && !plan.patientQuery.trim()) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['patientQuery'],
      message: 'An appointment request requires a patient query.',
    });
  }
});

export type AppointmentPlan = z.infer<typeof appointmentPlanSchema>;
type LiveProvider = Exclude<ConfiguredAgentProvider, 'auto'>;

const appointmentPlanJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    intent: {
      type: 'string',
      enum: ['conversation', 'show-appointment-details', 'reschedule-appointment'],
    },
    patientQuery: { type: 'string' },
    timeWindow: { type: 'string' },
    reply: { type: 'string' },
  },
  required: ['intent', 'patientQuery', 'timeWindow', 'reply'],
} as const;

const plannerInstructions =
  'Classify the request as casual conversation, viewing appointment details, or rescheduling an appointment. ' +
  'For casual conversation such as a greeting, use the conversation intent and write a brief, natural reply. ' +
  'For conversation, return empty patientQuery and timeWindow values. ' +
  'Questions asking when, what day, or what time an appointment is should use the show-appointment-details intent. ' +
  'Use John when the user refers to the current appointment without naming the patient. ' +
  'Only extract a time window for rescheduling; otherwise return an empty timeWindow. ' +
  'For appointment intents return an empty reply. ' +
  'Do not invent other patient names or dates.';

function fallbackPlan(goal: string): AppointmentPlan {
  const asksToMove = /\b(move|reschedule|change)\b/i.test(goal);
  return {
    intent: asksToMove ? 'reschedule-appointment' : 'show-appointment-details',
    patientQuery: 'John',
    timeWindow: asksToMove ? 'Monday afternoon' : '',
    // Demo/fallback deliberately stays on the deterministic appointment script.
    reply: '',
  };
}

async function planWithOpenAi(goal: string): Promise<AppointmentPlan> {
  if (!env.openAiApiKey) throw new Error('OPENAI_API_KEY is not configured.');

  const openai = new OpenAI({ apiKey: env.openAiApiKey, timeout: 8_000, maxRetries: 1 });
  const response = await openai.responses.create({
    model: env.openAiModel,
    instructions: plannerInstructions,
    input: goal,
    text: {
      format: {
        type: 'json_schema',
        name: 'appointment_plan',
        strict: true,
        schema: appointmentPlanJsonSchema,
      },
    },
  });

  return appointmentPlanSchema.parse(JSON.parse(response.output_text));
}

async function planWithGemini(goal: string): Promise<AppointmentPlan> {
  if (!env.geminiApiKey) throw new Error('GEMINI_API_KEY is not configured.');

  // Gemini is instantiated only on the backend; its API key never reaches Angular.
  const gemini = new GoogleGenAI({
    apiKey: env.geminiApiKey,
    // Gemini requires manually configured deadlines to be at least 10 seconds.
    httpOptions: { timeout: 15_000 },
  });
  const response = await gemini.models.generateContent({
    model: env.geminiModel,
    contents: goal,
    config: {
      systemInstruction: plannerInstructions,
      responseMimeType: 'application/json',
      responseJsonSchema: appointmentPlanJsonSchema,
    },
  });

  if (!response.text) throw new Error('Gemini returned an empty planning response.');
  return appointmentPlanSchema.parse(JSON.parse(response.text));
}

function providerCandidates(): LiveProvider[] {
  if (env.agentProvider !== 'auto') return [env.agentProvider];

  const providers: LiveProvider[] = [];
  if (env.openAiApiKey) providers.push('openai');
  if (env.geminiApiKey) providers.push('gemini');
  return providers;
}

export async function planGoal(goal: string): Promise<{
  plan: AppointmentPlan;
  mode: 'live' | 'demo' | 'fallback';
}> {
  if (env.agentMode === 'demo') {
    return { plan: fallbackPlan(goal), mode: 'demo' };
  }

  const providers = providerCandidates();
  if (providers.length === 0) {
    if (env.agentMode === 'live') {
      throw new Error('Configure OPENAI_API_KEY or GEMINI_API_KEY when AGENT_MODE=live.');
    }
    return { plan: fallbackPlan(goal), mode: 'fallback' };
  }

  let lastError: unknown;
  for (const provider of providers) {
    try {
      const plan = provider === 'openai'
        ? await planWithOpenAi(goal)
        : await planWithGemini(goal);
      console.log(plan, 'PLAN');
      return { plan, mode: 'live' };
    } catch (error) {
      lastError = error;
    }
  }

  if (env.agentMode === 'live') {
    throw lastError instanceof Error ? lastError : new Error('The configured model provider failed.');
  }
  return { plan: fallbackPlan(goal), mode: 'fallback' };
}
