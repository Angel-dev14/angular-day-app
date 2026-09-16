import { EventEncoder } from '@ag-ui/encoder';
import { EventType, RunAgentInputSchema, type BaseEvent } from '@ag-ui/core';
import { Router } from 'express';
import { runWorkflow } from '../agent/workflow.js';

export const agUiRouter = Router();

agUiRouter.post('/agent', async (request, response) => {
  // HttpAgent uses a POST request, while EventEncoder keeps the response fully
  // AG-UI compatible over SSE (including content negotiation and framing).
  const encoder = new EventEncoder({ accept: request.header('accept') });
  response.status(200);
  response.setHeader('Content-Type', encoder.getContentType());
  response.setHeader('Cache-Control', 'no-cache, no-transform');
  response.setHeader('Connection', 'keep-alive');
  response.setHeader('X-Accel-Buffering', 'no');
  response.flushHeaders();

  try {
    // Reject malformed client input before it can reach the workflow or tools.
    // console.log('Received agent input:', request.body);
    const input = RunAgentInputSchema.parse(request.body);
    for await (const event of runWorkflow(input)) {
      response.write(encoder.encode(event));
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected agent error.';
    const event: BaseEvent = { type: EventType.RUN_ERROR, message, code: 'AGENT_RUN_FAILED' };
    response.write(encoder.encode(event));
  } finally {
    response.end();
  }
});
