# Proposed architecture

This repository will be an npm-workspace monorepo with three deliberately small
parts:

- `apps/web`: Angular 21 standalone, zoneless frontend. Signals hold the local
  projection of AG-UI state.
- `apps/agent`: Node.js/TypeScript HTTP server. It owns the OpenAI client, tool
  orchestration, in-memory data, demo-mode fallback, and the AG-UI SSE endpoint.
- `packages/contracts`: shared TypeScript contracts for appointment data,
  activity entries, trusted interaction identifiers, and client actions.

## Runtime boundary

```text
Angular trusted UI
  -> POST RunAgentInput
  <- AG-UI event stream (SSE)
Node agent backend
  -> OpenAI Responses API or Gemini Generate Content API (when available)
  -> deterministic workflow runner (demo fallback)
  -> typed in-memory tools
```

The browser never receives an API key and never evaluates model-produced markup,
templates, component names, or code.

## Human-in-the-loop runs

The workflow uses short, resumable AG-UI runs rather than holding an HTTP stream
open while a person decides:

1. Details-only run: “Show me John's appointment details” calls
   `searchPatient`, `getAppointments`, and `getAppointmentDetails`, renders the
   trusted details view, and stops without fetching slots.
2. Rescheduling goal run: tools find John, his appointment, the full appointment details, and
   Monday slots. The detail result immediately becomes trusted application state;
   the final state requests `appointment-slot-picker` and marks the run as
   awaiting input.
3. Selection run: Angular submits a typed `slot-selected` action. The resulting
   state requests `confirmation`.
4. Confirmation run: Angular submits `reschedule-confirmed`; the backend calls
   `rescheduleAppointment`, emits updated state, and streams a short message.

Thread/workflow state is kept in memory for the demo and resettable from the UI.

## AG-UI event projection

- `RUN_STARTED`, `RUN_FINISHED`, `RUN_ERROR`: run status and error UI.
- `STEP_STARTED`, `STEP_FINISHED`: high-level workflow progress.
- `TOOL_CALL_START`, `TOOL_CALL_ARGS`, `TOOL_CALL_END`, `TOOL_CALL_RESULT`:
  visible, explainable tool activity.
- `STATE_SNAPSHOT`: authoritative demo state: appointment, appointment details,
  available slots, activity list, workflow phase, and requested interaction.
- `TEXT_MESSAGE_*`: assistant-panel text only; never used to select UI.

The Angular AG-UI service projects events into signals. Components read those
signals; they do not parse assistant prose.

## Trusted component rendering

The interaction contract is a discriminated union whose only initial identifiers
are `appointment-slot-picker` and `confirmation`. A frontend registry explicitly
maps those identifiers to compiled Angular components. Unknown identifiers render
a safe unsupported-interaction message and are logged; arbitrary HTML is never
inserted.

Each registry entry also validates/narrows its payload before rendering. Component
outputs become typed client actions sent in the next AG-UI run.

## Reliability strategy

`AGENT_MODE=demo` uses a deterministic scripted planner while emitting the same
AG-UI events as the live path. `AGENT_PROVIDER=openai|gemini|auto` selects the live
planner. `AGENT_MODE=auto` attempts configured providers and falls back to the
scripted planner on configuration, timeout, rate-limit, or API failure. The UI
shows which mode served the run. Mock tool results and IDs remain stable, and a
reset endpoint restores the presentation state.
