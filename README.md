# Beyond the Chatbox: Building Agentic Experiences with Angular

A small Angular Day conference demo in which an Angular 21 appointment app
participates in an agentic workflow over AG-UI. The model decides what the user
needs; Angular renders only trusted, application-owned components.

## Run it

Requirements: Node.js 22.13 or newer and npm.

```bash
npm install
npm start
```

Open `http://localhost:4200` and run the pre-filled goal:

> Move John's appointment to Monday afternoon.

You can also run a details-only goal first:

> Show me John's appointment details.

That path stops after `searchPatient`, `getAppointments`, and
`getAppointmentDetails`. It renders the details card and leaves the assistant
ready for a later rescheduling request.

The default `auto` mode uses the configured provider when available and falls
back to the deterministic demo planner if no provider is configured or the API
call fails, so the complete demo works offline.

## Agent modes

Copy `apps/agent/.env.example` to `apps/agent/.env`, or export variables before
starting:

```bash
# Guaranteed deterministic conference path
AGENT_MODE=demo npm start

# Require the OpenAI planning call; surface failures in the UI
AGENT_MODE=live AGENT_PROVIDER=openai OPENAI_API_KEY=... npm start

# Require Gemini Flash planning; the key stays in the Node backend
AGENT_MODE=live AGENT_PROVIDER=gemini GEMINI_API_KEY=... GEMINI_MODEL=gemini-3.8-flash npm start

# Auto-select configured providers, then use the deterministic planner on failure
AGENT_MODE=auto GEMINI_API_KEY=... npm start
```

`AGENT_PROVIDER=auto` tries OpenAI first when both keys are present, then Gemini.
Set it explicitly to make a conference run use one provider. Both API keys are
read only by `apps/agent`; neither is included in the Angular bundle. The model
defaults are `gpt-5-mini` for OpenAI and `gemini-3.8-flash` for Gemini, so the
`OPENAI_MODEL` and `GEMINI_MODEL` variables are optional unless you want an
explicit override.

## Useful commands

```bash
npm run build
npm test
npm run reset-demo
```

## What to point out on stage

- `apps/web/src/app/core/ag-ui/agent-client.service.ts` projects typed AG-UI
  events into Angular signals.
- `apps/web/src/app/core/ag-ui/trusted-interaction-outlet.component.ts` is the
  explicit component allowlist and dynamic rendering boundary.
- `apps/agent/src/agent/workflow.ts` emits lifecycle, step, tool, state, and text
  events over three resumable runs.
- `getAppointmentDetails` demonstrates a tool result becoming validated AG-UI
  state and a trusted details card in the main application surface.
- `packages/contracts/src/index.ts` validates all UI state and human actions.
- Assistant text is display-only. It never controls component rendering.

See [`docs/architecture.md`](docs/architecture.md) for the protocol walkthrough.
# angular-day-app
