import {
  clientActionSchema,
  demoStateSchema,
  type ActivityItem,
  type AppointmentDetails,
  type ClientAction,
  type DemoState,
  type Patient,
} from '@angular-day/contracts';
import {
  EventType,
  type BaseEvent,
  type Message,
  type RunAgentInput,
} from '@ag-ui/core';
import { env } from '../config/env.js';
import { mockStore } from '../data/mock-store.js';
import { appointmentTools, type AppointmentToolName } from '../tools/appointment-tools.js';
import { planGoal, type AppointmentPlan } from './planner.js';

type RunIdentity = { threadId: string; runId: string };
type WorkflowMode = DemoState['mode'];
type RunStatus =
  | 'awaiting-confirmation'
  | 'awaiting-slot'
  | 'cancelled'
  | 'complete'
  | 'details-shown';

const delay = () => new Promise((resolve) => setTimeout(resolve, env.stepDelayMs));

function latestUserText(messages: Message[]): string {
  const message = [...messages].reverse().find((item) => item.role === 'user');
  return message && typeof message.content === 'string' ? message.content : '';
}

function initialState(): DemoState {
  return {
    patient: null,
    appointment: mockStore.currentAppointment(),
    appointmentDetails: null,
    slots: [],
    interaction: null,
    activity: [],
    phase: 'idle',
    mode: 'demo',
    error: null,
  };
}

function stateFromInput(input: RunAgentInput): DemoState {
  const parsed = demoStateSchema.safeParse(input.state);
  return parsed.success ? structuredClone(parsed.data) : initialState();
}

function activity(id: string, label: string, status: ActivityItem['status']): ActivityItem {
  return { id, label, status };
}

function startActivity(state: DemoState, id: string, label = id): void {
  state.activity.push(activity(id, label, 'running'));
}

function completeActivity(state: DemoState, id: string, label?: string): void {
  state.activity = state.activity.map((item) =>
    item.id === id ? activity(id, label ?? item.label, 'complete') : item,
  );
}

function stateEvent(state: DemoState): BaseEvent {
  return { type: EventType.STATE_SNAPSHOT, snapshot: structuredClone(state) };
}

function runFinishedEvent(run: RunIdentity, status: RunStatus): BaseEvent {
  return { type: EventType.RUN_FINISHED, ...run, result: { status } };
}

function textEvents(text: string): BaseEvent[] {
  const messageId = crypto.randomUUID();
  return [
    { type: EventType.TEXT_MESSAGE_START, messageId, role: 'assistant' },
    { type: EventType.TEXT_MESSAGE_CONTENT, messageId, delta: text },
    { type: EventType.TEXT_MESSAGE_END, messageId },
  ];
}

async function* callTool<T>(
  name: AppointmentToolName,
  args: Record<string, string>,
  execute: () => T,
): AsyncGenerator<BaseEvent, T> {
  const toolCallId = crypto.randomUUID();
  yield { type: EventType.STEP_STARTED, stepName: name };
  yield { type: EventType.TOOL_CALL_START, toolCallId, toolCallName: name };
  yield { type: EventType.TOOL_CALL_ARGS, toolCallId, delta: JSON.stringify(args) };
  await delay();
  const result = execute();
  yield { type: EventType.TOOL_CALL_END, toolCallId };
  yield {
    type: EventType.TOOL_CALL_RESULT,
    messageId: crypto.randomUUID(),
    toolCallId,
    content: JSON.stringify(result),
    role: 'tool',
  };
  yield { type: EventType.STEP_FINISHED, stepName: name };
  return result;
}

async function* discoverAppointment(
  state: DemoState,
  patientQuery: string,
): AsyncGenerator<BaseEvent, { patient: Patient; details: AppointmentDetails }> {
  state.phase = 'searching-patient';
  state.activity = [];
  startActivity(state, 'searchPatient');
  yield stateEvent(state);

  const patient = yield* callTool('searchPatient', { name: patientQuery }, () =>
    appointmentTools.searchPatient(patientQuery),
  );
  if (!patient) throw new Error(`No patient matching “${patientQuery}” was found.`);

  state.patient = patient;
  completeActivity(state, 'searchPatient');
  yield stateEvent(state);

  state.phase = 'loading-appointments';
  startActivity(state, 'getAppointments');
  yield stateEvent(state);

  const appointments = yield* callTool('getAppointments', { patientId: patient.id }, () =>
    appointmentTools.getAppointments(patient.id),
  );
  if (!appointments[0]) throw new Error(`${patient.name} has no appointment to show.`);

  state.appointment = appointments[0];
  completeActivity(state, 'getAppointments');
  yield stateEvent(state);

  state.phase = 'loading-appointment-details';
  startActivity(state, 'getAppointmentDetails');
  yield stateEvent(state);

  const details = yield* callTool(
    'getAppointmentDetails',
    { appointmentId: state.appointment.id },
    () => appointmentTools.getAppointmentDetails(state.appointment.id),
  );
  state.appointmentDetails = details;
  completeActivity(state, 'getAppointmentDetails');
  yield stateEvent(state);

  return { patient, details };
}

async function* handleConversationIntent(
  state: DemoState,
  plan: AppointmentPlan,
  run: RunIdentity,
): AsyncGenerator<BaseEvent> {
  // Keep the workspace neutral: `complete` is reserved for a finished reschedule.
  state.phase = 'idle';
  yield stateEvent(state);
  // Conversational model output is display-only and cannot select trusted UI components.
  yield* textEvents(plan.reply || 'Hi! How can I help?');
  yield runFinishedEvent(run, 'complete');
}

async function* handleDetailsIntent(
  state: DemoState,
  plan: AppointmentPlan,
  run: RunIdentity,
): AsyncGenerator<BaseEvent> {
  const { patient, details } = yield* discoverAppointment(state, plan.patientQuery);
  state.phase = 'details-shown';
  state.interaction = null;
  yield stateEvent(state);
  yield* textEvents(`${patient.name}'s appointment is ${details.day} at ${details.time}.`);
  yield runFinishedEvent(run, 'details-shown');
}

async function* handleRescheduleIntent(
  state: DemoState,
  plan: AppointmentPlan,
  run: RunIdentity,
): AsyncGenerator<BaseEvent> {
  yield* discoverAppointment(state, plan.patientQuery);

  state.phase = 'loading-slots';
  startActivity(state, 'getAvailableSlots');
  yield stateEvent(state);

  const slots = yield* callTool('getAvailableSlots', { window: plan.timeWindow }, () =>
    appointmentTools.getAvailableSlots(plan.timeWindow),
  );
  state.slots = slots;
  completeActivity(state, 'getAvailableSlots');
  state.activity.push(activity('waiting-selection', 'Waiting for user selection', 'waiting'));
  state.phase = 'awaiting-slot';
  state.interaction = {
    interaction: 'appointment-slot-picker',
    data: { prompt: 'Choose a Monday afternoon time', slots },
  };
  yield stateEvent(state);
  yield runFinishedEvent(run, 'awaiting-slot');
}

async function* handleClientAction(
  state: DemoState,
  action: ClientAction,
  mode: WorkflowMode,
  run: RunIdentity,
): AsyncGenerator<BaseEvent> {
  state.mode = mode;

  switch (action.type) {
    case 'slot-selected': {
      const availableSlots = state.slots.length
        ? state.slots
        : appointmentTools.getAvailableSlots('Monday afternoon');
      const slot = availableSlots.find((candidate) => candidate.id === action.slotId);
      if (!slot) throw new Error('The selected slot is no longer available.');

      state.phase = 'awaiting-confirmation';
      state.slots = availableSlots;
      state.interaction = {
        interaction: 'confirmation',
        data: {
          appointmentId: state.appointment.id,
          slotId: slot.id,
          patientName: state.appointment.patientName,
          fromDay: state.appointment.day,
          fromTime: state.appointment.time,
          toDay: slot.day,
          toTime: slot.time,
        },
      };
      state.activity = state.activity
        .filter((item) => item.id !== 'waiting-confirmation')
        .map((item) => item.id === 'waiting-selection'
          ? activity(item.id, `Selected ${slot.time}`, 'complete')
          : item);
      state.activity.push(activity('waiting-confirmation', 'Waiting for confirmation', 'waiting'));
      yield stateEvent(state);
      yield runFinishedEvent(run, 'awaiting-confirmation');
      return;
    }

    case 'reschedule-cancelled': {
      const resetState = initialState();
      resetState.mode = mode;
      yield stateEvent(resetState);
      yield* textEvents('No changes were made.');
      yield runFinishedEvent(run, 'cancelled');
      return;
    }

    case 'reschedule-confirmed': {
      state.phase = 'rescheduling';
      state.activity = state.activity
        .filter((item) => item.id !== 'rescheduleAppointment')
        .map((item) => item.id === 'waiting-confirmation'
          ? activity(item.id, 'Confirmed by user', 'complete')
          : item);
      startActivity(state, 'rescheduleAppointment');
      yield stateEvent(state);

      const appointment = yield* callTool(
        'rescheduleAppointment',
        { appointmentId: action.appointmentId, slotId: action.slotId },
        () => appointmentTools.rescheduleAppointment(action.appointmentId, action.slotId),
      );
      state.appointment = appointment;
      state.appointmentDetails = state.appointmentDetails
        ? { ...state.appointmentDetails, day: appointment.day, time: appointment.time }
        : null;
      state.interaction = null;
      state.phase = 'complete';
      completeActivity(state, 'rescheduleAppointment');
      yield stateEvent(state);
      yield* textEvents(`Done, John's appointment is now Monday at ${appointment.time}.`);
      yield runFinishedEvent(run, 'complete');
    }
  }
}

export async function* runWorkflow(
  input: RunAgentInput,
  goalPlanner: typeof planGoal = planGoal,
): AsyncGenerator<BaseEvent> {
  const run = { threadId: input.threadId, runId: input.runId || crypto.randomUUID() };
  yield { type: EventType.RUN_STARTED, ...run };

  const previousState = stateFromInput(input);
  const actionResult = clientActionSchema.safeParse(input.forwardedProps?.action);
  if (actionResult.success) {
    const mode = input.forwardedProps?.mode ?? 'demo';
    yield* handleClientAction(previousState, actionResult.data, mode, run);
    return;
  }

  const state = initialState();
  state.phase = 'planning';
  yield stateEvent(state);

  const { plan, mode } = await goalPlanner(latestUserText(input.messages));
  state.mode = mode;

  // Intent routing is explicit: each plan enters one small, named workflow.
  switch (plan.intent) {
    case 'conversation':
      yield* handleConversationIntent(state, plan, run);
      return;
    case 'show-appointment-details':
      yield* handleDetailsIntent(state, plan, run);
      return;
    case 'reschedule-appointment':
      yield* handleRescheduleIntent(state, plan, run);
  }
}
