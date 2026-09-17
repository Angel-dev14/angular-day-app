import { computed, Injectable, signal } from '@angular/core';
import { HttpAgent, type AgentSubscriber, EventType, type Message } from '@ag-ui/client';
import {
  demoStateSchema,
  type Appointment,
  type ClientAction,
  type DemoState,
} from '@angular-day/contracts';

const initialAppointment: Appointment = {
  id: 'appointment-001',
  patientId: 'patient-001',
  patientName: 'John Smith',
  day: 'Friday',
  time: '10:30',
};

function emptyState(appointment = initialAppointment): DemoState {
  return {
    patient: null,
    appointment,
    appointmentDetails: null,
    slots: [],
    interaction: null,
    activity: [],
    phase: 'idle',
    mode: 'demo',
    error: null,
  };
}

@Injectable({ providedIn: 'root' })
export class AgentClient {
  private readonly agent = new HttpAgent({
    url: '/api/agent',
    agentId: 'appointment-agent',
    threadId: crypto.randomUUID(),
    initialState: emptyState(),
  });

  private readonly stateSignal = signal<DemoState>(emptyState());
  private readonly runningSignal = signal(false);
  private readonly assistantTextSignal = signal('');
  private readonly userTextSignal = signal('');
  private readonly errorSignal = signal<string | null>(null);
  private readonly eventCountSignal = signal(0);
  private readonly lastEventSignal = signal('READY');

  readonly state = this.stateSignal.asReadonly();
  readonly isRunning = this.runningSignal.asReadonly();
  readonly assistantText = this.assistantTextSignal.asReadonly();
  readonly userText = this.userTextSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  readonly eventCount = this.eventCountSignal.asReadonly();
  readonly lastEvent = this.lastEventSignal.asReadonly();
  readonly canStart = computed(
    () => !this.runningSignal() && this.stateSignal().interaction === null,
  );

  private readonly subscriber: AgentSubscriber = {
    // Angular consumes protocol events and validated state, never assistant prose.
    onEvent: ({ event }) => {
      this.eventCountSignal.update((count) => count + 1);
      this.lastEventSignal.set(event.type);

      if (event.type === EventType.STATE_SNAPSHOT) {
        const parsed = demoStateSchema.safeParse(event['snapshot']);
        if (parsed.success) {
          this.stateSignal.set(parsed.data);
        } else {
          this.errorSignal.set('The agent sent state that the trusted UI could not validate.');
        }
      } else if (event.type === EventType.TEXT_MESSAGE_START) {
        this.assistantTextSignal.set('');
      } else if (event.type === EventType.TEXT_MESSAGE_CONTENT) {
        const delta = event['delta'];
        if (typeof delta === 'string') {
          this.assistantTextSignal.update((text) => text + delta);
        }
      } else if (event.type === EventType.RUN_ERROR) {
        const message = event['message'];
        this.errorSignal.set(typeof message === 'string' ? message : 'The agent run failed.');
      }
    },
  };

  async sendGoal(goal: string): Promise<void> {
    const trimmedGoal = goal.trim();
    if (!trimmedGoal || this.runningSignal()) return;

    this.userTextSignal.set(trimmedGoal);
    this.assistantTextSignal.set('');
    this.errorSignal.set(null);
    this.agent.addMessage({ id: crypto.randomUUID(), role: 'user', content: trimmedGoal });
    await this.run();
  }

  async sendAction(action: ClientAction): Promise<void> {
    if (this.runningSignal()) return;
    this.errorSignal.set(null);
    await this.run({ action, mode: this.stateSignal().mode });
  }

  async reset(): Promise<void> {
    try {
      const response = await fetch('/api/reset', { method: 'POST' });
      if (!response.ok) throw new Error('Reset request failed.');
      const payload = (await response.json()) as { appointment: Appointment };
      this.agent.setMessages([] as Message[]);
      this.agent.setState(emptyState(payload.appointment));
      this.stateSignal.set(emptyState(payload.appointment));
      this.userTextSignal.set('');
      this.assistantTextSignal.set('');
      this.errorSignal.set(null);
      this.eventCountSignal.set(0);
      this.lastEventSignal.set('READY');
    } catch (error) {
      this.errorSignal.set(error instanceof Error ? error.message : 'Could not reset the demo.');
    }
  }

  private async run(forwardedProps?: Record<string, unknown>): Promise<void> {
    this.runningSignal.set(true);
    try {
      await this.agent.runAgent({ forwardedProps }, this.subscriber);
    } catch (error) {
      this.errorSignal.set(error instanceof Error ? error.message : 'The agent run failed.');
    } finally {
      this.runningSignal.set(false);
    }
  }
}
