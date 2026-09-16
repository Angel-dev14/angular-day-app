import cors from 'cors';
import express from 'express';
import { env } from './config/env.js';
import { mockStore } from './data/mock-store.js';
import { agUiRouter } from './transport/ag-ui-route.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use('/api', agUiRouter);

app.get('/api/health', (_request, response) => {
  response.json({
    ok: true,
    configuredMode: env.agentMode,
    configuredProvider: env.agentProvider,
    providers: {
      openai: Boolean(env.openAiApiKey),
      gemini: Boolean(env.geminiApiKey),
    },
  });
});

app.post('/api/reset', (_request, response) => {
  response.json({ appointment: mockStore.reset() });
});

app.listen(env.port, () => {
  console.log(`Agent backend listening on http://localhost:${env.port}`);
});
