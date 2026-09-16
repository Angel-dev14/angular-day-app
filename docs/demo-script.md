# Demo script — From Intent to Action

Target duration: 6–8 minutes  
Talk: **Beyond the Chatbox: Building Agentic Experiences with Angular**

## Before going on stage

- Start the application and open `http://localhost:4200`.
- Test the complete rescheduling flow once.
- Press **Reset demo** so John is back on Friday at 10:30.
- Keep the browser at a readable zoom level.
- Keep these three files open in the editor:
  1. `apps/agent/src/agent/workflow.ts`
  2. `apps/web/src/app/core/ag-ui/agent-client.service.ts`
  3. `apps/web/src/app/core/ag-ui/trusted-interaction-outlet.component.ts`
- Use `AGENT_MODE=auto` for a live model with deterministic fallback.
- If network reliability is uncertain, use `AGENT_MODE=demo`.

## Opening — 20 seconds

### Show

Switch from the **Demo: From Intent to Action** slide to the running application.

### Say

> This looks like a normal appointment-management application. The assistant is intentionally small because the interesting part is not the chatbox—the interesting part is how the rest of the Angular application reacts to the agent workflow.

## Part 1: Ask for appointment information — 1 minute

### Show

Enter:

> When is John Smith's appointment?

While it runs, point to the **Agent activity** panel. Let the audience see:

```text
searchPatient
getAppointments
getAppointmentDetails
```

Then point to the appointment-details card and the assistant response:

> John Smith's appointment is Friday at 10:30.

### Say

> This did not return only a sentence. The workflow searched for the patient, loaded the appointment, and fetched its details. Those tool results became structured application state, and Angular rendered the existing appointment-details component.

> The model did not generate this card. It did not generate HTML or an Angular template. Angular owns the component, styling, accessibility, and rendering.

## Part 2: Start the agentic workflow — 1 minute

### Show

Enter:

> Move John's appointment to Monday afternoon.

Point to each activity entry as it completes:

```text
searchPatient
getAppointments
getAppointmentDetails
getAvailableSlots
Waiting for user selection
```

Wait for the slot picker to appear in the main workspace.

### Say

> Now the user has expressed an outcome, not a navigation path. They did not search for John, open his record, find the edit screen, or inspect a calendar.

> The backend interpreted the goal and coordinated the application tools. When it reached a point that required human input, it sent structured state saying that the next interaction is an appointment slot picker.

## Part 3: Trusted dynamic UI — 1 minute

### Show

Point to the three available Angular-rendered buttons:

```text
13:00
14:30
16:00
```

Select **14:30**.

### Say

> The backend decided what interaction was needed. Angular decided how that interaction should look and behave.

> This is not arbitrary model-generated UI. The identifier `appointment-slot-picker` is mapped to a component already compiled into this application. Unknown identifiers cannot render arbitrary content.

## Part 4: Human in the loop — 1 minute

### Show

After selecting 14:30, pause on the confirmation component:

> Move appointment from Friday 10:30 to Monday 14:30?

Click **Confirm change** and point to:

- `rescheduleAppointment` completing in the activity panel.
- The main appointment card changing to Monday at 14:30.
- The short assistant confirmation.

### Say

> Selecting a slot did not immediately mutate the appointment. The first run finished while waiting for the user, and Angular sent the typed selection in a new run on the same thread.

> The confirmation is another trusted Angular component. Only after the user confirms does the workflow call `rescheduleAppointment`, update application state, and send the final response.

## Part 5: Show the code — 2–3 minutes

Do not walk through entire files. Show only the following three boundaries.

### 1. Backend requests an interaction

Open `apps/agent/src/agent/workflow.ts` at the slot-picker state assignment.

### Show

```ts
state.interaction = {
  interaction: 'appointment-slot-picker',
  data: { prompt: 'Choose a Monday afternoon time', slots },
};
yield stateEvent(state);
```

### Say

> The backend does not send HTML. It sends a small semantic identifier and structured data inside an AG-UI state snapshot.

> In this demo, the model produces a structured intent and the workflow deterministically decides which tools and interactions are allowed. This keeps the live demonstration predictable and makes the security boundary explicit.

### 2. Angular validates incoming state

Open `apps/web/src/app/core/ag-ui/agent-client.service.ts` at the `STATE_SNAPSHOT` handler.

### Show

```ts
if (event.type === EventType.STATE_SNAPSHOT) {
  const parsed = demoStateSchema.safeParse(event['snapshot']);
  if (parsed.success) {
    this.stateSignal.set(parsed.data);
  }
}
```

### Say

> AG-UI's `HttpAgent` receives and decodes the event stream. Before Angular uses the application state, we validate it against the shared schema and then place it in a signal.

> AG-UI defines the event envelope. The appointment state inside that envelope is our application contract.

### 3. Angular selects a trusted component

Open `apps/web/src/app/core/ag-ui/trusted-interaction-outlet.component.ts` at the registry.

### Show

```ts
export const TRUSTED_INTERACTION_COMPONENTS = {
  'appointment-slot-picker': AppointmentSlotPicker,
  confirmation: Confirmation,
};
```

Then show:

```ts
const componentType = TRUSTED_INTERACTION_COMPONENTS[interaction.interaction];
const ref = host.createComponent(componentType);
ref.setInput('data', interaction.data);
```

### Say

> This is the trust boundary. The agent can choose from capabilities we explicitly expose, but Angular controls the component implementation.

> We keep normal Angular advantages: typed inputs and outputs, signals, validation, accessibility, testing, and our design system.

## Closing — 20 seconds

### Show

Return to the completed application state, then continue to the **Guardrails** slide.

### Say

> The key idea is not that AI replaces the frontend. We add an intent and orchestration layer on top of application capabilities we already trust.

> The model helps decide what is needed. The backend controls what can execute. Angular decides how the experience is rendered.

## If you only have 5 minutes

Skip the first appointment-details question. Start immediately with:

> Move John's appointment to Monday afternoon.

Complete the selection and confirmation flow, then show only:

1. The structured interaction in `workflow.ts`.
2. The trusted registry in `trusted-interaction-outlet.component.ts`.

Use the final 20 seconds for the closing statement.

## Optional live-mode moment

If there is enough time, reset the demo and enter:

> Hi

### Say

> In live mode, an ordinary greeting remains an ordinary conversation. It does not trigger appointment tools or change the main application, because conversational intent and application intent are handled separately.

Do not include this step when running deterministic demo mode, because fallback mode intentionally routes non-rescheduling input through the fixed appointment-details path.

## Technical wording to keep accurate

- Say **“the agent workflow calls tools”** for this implementation. The LLM currently classifies the intent; it does not directly execute native model tool calls.
- Say **“the run finishes while waiting for input and resumes in a new run”**. This demo uses `STATE_SNAPSHOT`, `RUN_FINISHED`, and `forwardedProps.action`; it does not emit a formal interrupt event.
- Say **“AG-UI transports structured events and state”**. Your application still defines and validates the appointment-specific state schema.
- Say **“trusted dynamic UI”**, not model-generated Angular UI.

## Recovery plan

If the model API fails while using `AGENT_MODE=auto`, continue normally—the backend uses the deterministic fallback while emitting the same AG-UI workflow events.

If the application state is unexpected:

1. Click **Reset demo**.
2. Retry the rescheduling sentence exactly as written.
3. If needed, restart with deterministic mode:

```bash
AGENT_MODE=demo npm start
```

