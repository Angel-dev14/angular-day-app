import { Component, input, output } from '@angular/core';
import type { AgentInteraction, ClientAction } from '@angular-day/contracts';

type ConfirmationData = Extract<AgentInteraction, { interaction: 'confirmation' }>['data'];

@Component({
  selector: 'app-confirmation',
  templateUrl: './confirmation.component.html',
  styleUrl: './confirmation.component.scss',
})
export class Confirmation {
  readonly data = input.required<ConfirmationData>();
  readonly action = output<ClientAction>();

  confirm(): void {
    this.action.emit({ type: 'reschedule-confirmed', appointmentId: this.data().appointmentId, slotId: this.data().slotId });
  }

  cancel(): void {
    this.action.emit({ type: 'reschedule-cancelled' });
  }
}
