import {
  clientActionSchema,
  demoStateSchema,
  type ActivityItem,
  type DemoState
} from '@angular-day/contracts';
import {
  EventType,
  type BaseEvent,
  type Message,
  type RunAgentInput
} from '@ag-ui/core';
import { env } from '../config/env.js';
import { mockStore } from '../data/mock-store.js';
import { appointmentTools, type AppointmentToolName } from '../tools/appointment-tools.js';
import { planGoal } from './planner.js';

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
    error: null
  };
}

function stateFromInput(input: RunAgentInput): DemoState {
  const parsed = demoStateSchema.safeParse(input.state);
  return parsed.success ? structuredClone(parsed.data) : initialState();
}

function activity(id: string, label: string, status: ActivityItem['status']): ActivityItem {
  return { id, label, status };
}

function stateEvent(state: DemoState): BaseEvent {
  return { type: EventType.STATE_SNAPSHOT, snapshot: state };
}

function textEvents(text: string): BaseEvent[] {
  const messageId = crypto.randomUUID();
  return [
    { type: EventType.TEXT_MESSAGE_START, messageId, role: 'assistant' },
    { type: EventType.TEXT_MESSAGE_CONTENT, messageId, delta: text },
    { type: EventType.TEXT_MESSAGE_END, messageId }
  ];
}

async function* callTool<T>(
  name: AppointmentToolName,
  args: Record<string, string>,
  execute: () => T
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
    role: 'tool'
  };
  yield { type: EventType.STEP_FINISHED, stepName: name };
  return result;
}

export async function* runWorkflow(
  input: RunAgentInput,
  goalPlanner: typeof planGoal = planGoal
): AsyncGenerator<BaseEvent> {
  const runId = input.runId || crypto.randomUUID();
  yield { type: EventType.RUN_STARTED, threadId: input.threadId, runId };

  let state = stateFromInput(input);
  const actionResult = clientActionSchema.safeParse(input.forwardedProps?.action);

  if (actionResult.success) {
    const action = actionResult.data;
    state.mode = input.forwardedProps?.mode ?? 'demo';

    if (action.type === 'slot-selected') {
      const availableSlots = state.slots.length
        ? state.slots
        : appointmentTools.getAvailableSlots('Monday afternoon');
      const slot = availableSlots.find((candidate) => candidate.id === action.slotId);
      if (!slot) {
        throw new Error('The selected slot is no longer available.');
      }

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
          toTime: slot.time
        }
      };
      state.activity = state.activity
        .filter((item) => item.id !== 'waiting-confirmation')
        .map((item) => item.id === 'waiting-selection' ? activity(item.id, `Selected ${slot.time}`, 'complete') : item);
      state.activity.push(activity('waiting-confirmation', 'Waiting for confirmation', 'waiting'));
      // Human-in-the-loop pause: publish trusted UI state, finish this HTTP run,
      // and resume with a typed client action in a fresh AG-UI run.
      yield stateEvent(state);
        yield {
          type: EventType.RUN_FINISHED,
          threadId: input.threadId,
          runId,
          result: { status: 'awaiting-confirmation' }
        };
      return;
    }

    if (action.type === 'reschedule-cancelled') {
      state = initialState();
      yield stateEvent(state);
      yield* textEvents('No changes were made.');
      yield { type: EventType.RUN_FINISHED, threadId: input.threadId, runId, result: { status: 'cancelled' } };
      return;
    }

    state.phase = 'working';
    state.activity = state.activity
      .filter((item) => item.id !== 'rescheduleAppointment')
      .map((item) => item.id === 'waiting-confirmation' ? activity(item.id, 'Confirmed by user', 'complete') : item);
    state.activity.push(activity('rescheduleAppointment', 'rescheduleAppointment', 'running'));
    yield stateEvent(state);
    const appointment = yield* callTool(
      'rescheduleAppointment',
      { appointmentId: action.appointmentId, slotId: action.slotId },
      () => appointmentTools.rescheduleAppointment(action.appointmentId, action.slotId)
    );
    state = {
      ...state,
      appointment,
      appointmentDetails: state.appointmentDetails
        ? { ...state.appointmentDetails, day: appointment.day, time: appointment.time }
        : null,
      interaction: null,
      phase: 'complete',
      activity: state.activity.map((item) =>
        item.id === 'rescheduleAppointment' ? activity(item.id, item.label, 'complete') : item
      )
    };
    yield stateEvent(state);
    yield* textEvents(`Done, John's appointment is now Monday at ${appointment.time}.`);
    yield { type: EventType.RUN_FINISHED, threadId: input.threadId, runId, result: { status: 'complete' } };
    return;
  }

  state = initialState();
  state.phase = 'working';
  yield stateEvent(state);
  const { plan, mode } = await goalPlanner(latestUserText(input.messages));
  state.mode = mode;

  if (mode === 'live' && plan.intent === 'conversation') {
    // Keep the workspace neutral: `complete` is reserved for a finished reschedule
    // and causes Angular to show its "Appointment updated" success card.
    state.phase = 'idle';
    yield stateEvent(state);
    // Conversational model output is display-only and cannot select trusted UI components.
    yield* textEvents(plan.reply || 'Hi! How can I help?');
    yield {
      type: EventType.RUN_FINISHED,
      threadId: input.threadId,
      runId,
      result: { status: 'complete' }
    };
    return;
  }

  console.log(plan.intent, 'INTENT');

  state.activity = [activity('searchPatient', 'searchPatient', 'running')];
  yield stateEvent(state);
  const patient = yield* callTool('searchPatient', { name: plan.patientQuery }, () =>
    appointmentTools.searchPatient(plan.patientQuery)
  );
  if (!patient) {
    throw new Error(`No patient matching “${plan.patientQuery}” was found.`);
  }
  state.patient = patient;
  state.activity[0] = activity('searchPatient', 'searchPatient', 'complete');
  yield stateEvent(state);

  state.activity.push(activity('getAppointments', 'getAppointments', 'running'));
  yield stateEvent(state);
  const appointments = yield* callTool('getAppointments', { patientId: patient.id }, () =>
    appointmentTools.getAppointments(patient.id)
  );
  if (!appointments[0]) {
    throw new Error('John has no appointment to show.');
  }
  state.appointment = appointments[0];
  state.activity[1] = activity('getAppointments', 'getAppointments', 'complete');
  yield stateEvent(state);

  state.activity.push(activity('getAppointmentDetails', 'getAppointmentDetails', 'running'));
  yield stateEvent(state);
  const appointmentDetails = yield* callTool(
    'getAppointmentDetails',
    { appointmentId: state.appointment.id },
    () => appointmentTools.getAppointmentDetails(state.appointment.id)
  );
  state.appointmentDetails = appointmentDetails;
  state.activity[2] = activity('getAppointmentDetails', 'getAppointmentDetails', 'complete');
  yield stateEvent(state);

  if (plan.intent === 'show-appointment-details') {
    state.phase = 'details-shown';
    state.interaction = null;
    yield stateEvent(state);
    yield* textEvents(
      `${patient.name}'s appointment is ${appointmentDetails.day} at ${appointmentDetails.time}.`
    );
    yield {
      type: EventType.RUN_FINISHED,
      threadId: input.threadId,
      runId,
      result: { status: 'details-shown' }
    };
    return;
  }

  state.activity.push(activity('getAvailableSlots', 'getAvailableSlots', 'running'));
  yield stateEvent(state);
  const slots = yield* callTool('getAvailableSlots', { window: plan.timeWindow }, () =>
    appointmentTools.getAvailableSlots(plan.timeWindow)
  );
  state.slots = slots;
  state.activity[3] = activity('getAvailableSlots', 'getAvailableSlots', 'complete');
  state.activity.push(activity('waiting-selection', 'Waiting for user selection', 'waiting'));
  state.phase = 'awaiting-slot';
  state.interaction = {
    interaction: 'appointment-slot-picker',
    data: { prompt: 'Choose a Monday afternoon time', slots }
  };
  yield stateEvent(state);
  yield { type: EventType.RUN_FINISHED, threadId: input.threadId, runId, result: { status: 'awaiting-slot' } };
}
