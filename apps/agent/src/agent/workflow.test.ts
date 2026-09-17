import { EventType, type BaseEvent, type RunAgentInput } from '@ag-ui/core';
import { demoStateSchema } from '@angular-day/contracts';
import { beforeEach, describe, expect, it } from 'vitest';
import { mockStore } from '../data/mock-store.js';
import { runWorkflow } from './workflow.js';

function input(
  runId: string,
  forwardedProps?: Record<string, unknown>,
  goal = "Move John's appointment to Monday afternoon.",
  state: Record<string, unknown> = {},
): RunAgentInput {
  return {
    threadId: 'test-thread',
    runId,
    state,
    messages: forwardedProps
      ? []
      : [{ id: 'goal', role: 'user', content: goal }],
    tools: [],
    context: [],
    forwardedProps,
  };
}

async function collect(run: AsyncGenerator<BaseEvent>): Promise<BaseEvent[]> {
  const events: BaseEvent[] = [];
  for await (const event of run) events.push(event);
  return events;
}

describe('appointment workflow', () => {
  beforeEach(() => mockStore.reset());

  it('streams the discovery tools and requests a trusted slot picker', async () => {
    const events = await collect(runWorkflow(input('run-1')));
    const toolNames = events
      .filter((event) => event.type === EventType.TOOL_CALL_START)
      .map((event) => event['toolCallName']);
    const snapshots = events.filter((event) => event.type === EventType.STATE_SNAPSHOT);
    const finalState = demoStateSchema.parse(snapshots.at(-1)?.['snapshot']);

    expect(toolNames).toEqual([
      'searchPatient',
      'getAppointments',
      'getAppointmentDetails',
      'getAvailableSlots',
    ]);
    expect([...new Set(snapshots.map((event) =>
      demoStateSchema.parse(event['snapshot']).phase,
    ))]).toEqual([
      'planning',
      'searching-patient',
      'loading-appointments',
      'loading-appointment-details',
      'loading-slots',
      'awaiting-slot',
    ]);
    if (finalState.interaction?.interaction !== 'appointment-slot-picker') {
      throw new Error('Expected a slot-picker interaction.');
    }
    expect(finalState.interaction.interaction).toBe('appointment-slot-picker');
    expect(finalState.interaction.data.slots).toHaveLength(3);
    expect(finalState.appointmentDetails).toMatchObject({
      day: 'Friday',
      time: '10:30',
      clinician: 'Dr. Maya Chen',
      location: 'Riverside Clinic · Room 204',
    });
  });

  it('shows John’s appointment details without starting rescheduling', async () => {
    const events = await collect(
      runWorkflow(input('details-run', undefined, "Show me John's appointment details.")),
    );
    const toolNames = events
      .filter((event) => event.type === EventType.TOOL_CALL_START)
      .map((event) => event['toolCallName']);
    const finalState = demoStateSchema.parse(
      events.filter((event) => event.type === EventType.STATE_SNAPSHOT).at(-1)?.['snapshot'],
    );

    expect(toolNames).toEqual([
      'searchPatient',
      'getAppointments',
      'getAppointmentDetails',
    ]);
    expect(finalState.phase).toBe('details-shown');
    expect(finalState.interaction).toBeNull();
    expect(finalState.appointmentDetails?.clinician).toBe('Dr. Maya Chen');
    expect(events.some((event) => event.type === EventType.TEXT_MESSAGE_CONTENT &&
      event['delta'] === "John Smith's appointment is Friday at 10:30.")).toBe(true);
  });

  it('answers casual conversation in live mode without calling appointment tools', async () => {
    const events = await collect(runWorkflow(
      input('greeting-run', undefined, 'hi'),
      async () => ({
        mode: 'live',
        plan: {
          intent: 'conversation',
          patientQuery: '',
          timeWindow: '',
          reply: 'Hi! How can I help?',
        },
      }),
    ));
    const toolCalls = events.filter((event) => event.type === EventType.TOOL_CALL_START);
    const finalState = demoStateSchema.parse(
      events.filter((event) => event.type === EventType.STATE_SNAPSHOT).at(-1)?.['snapshot'],
    );

    expect(toolCalls).toHaveLength(0);
    expect(finalState).toMatchObject({ mode: 'live', phase: 'idle', activity: [] });
    expect(events.some((event) => event.type === EventType.TEXT_MESSAGE_CONTENT &&
      event['delta'] === 'Hi! How can I help?')).toBe(true);
  });

  it('waits for confirmation before calling the mutation tool', async () => {
    const discovery = await collect(runWorkflow(input('run-1')));
    const discoveryState = demoStateSchema.parse(
      discovery.filter((event) => event.type === EventType.STATE_SNAPSHOT).at(-1)?.['snapshot'],
    );
    const selection = await collect(
      runWorkflow(input(
        'run-2',
        { mode: 'demo', action: { type: 'slot-selected', slotId: 'slot-mon-1430' } },
        undefined,
        discoveryState,
      )),
    );
    const selectedState = demoStateSchema.parse(
      selection.find((event) => event.type === EventType.STATE_SNAPSHOT)?.['snapshot'],
    );
    if (selectedState.interaction?.interaction !== 'confirmation') {
      throw new Error('Expected a confirmation interaction.');
    }
    expect(selectedState.interaction.interaction).toBe('confirmation');
    expect(mockStore.currentAppointment().time).toBe('10:30');

    const confirmation = await collect(
      runWorkflow(
        input('run-3', {
          mode: 'demo',
          action: {
            type: 'reschedule-confirmed',
            appointmentId: 'appointment-001',
            slotId: 'slot-mon-1430',
          },
        }, undefined, selectedState),
      ),
    );
    expect(confirmation.some((event) => event.type === EventType.TOOL_CALL_START && event['toolCallName'] === 'rescheduleAppointment')).toBe(true);
    expect(mockStore.currentAppointment()).toMatchObject({ day: 'Monday', time: '14:30' });
    const confirmedState = demoStateSchema.parse(
      confirmation.filter((event) => event.type === EventType.STATE_SNAPSHOT).at(-1)?.['snapshot'],
    );
    expect(confirmedState.appointmentDetails).toMatchObject({ day: 'Monday', time: '14:30' });
  });
});
