import { Component, input, output } from '@angular/core';
import type { AgentInteraction, ClientAction } from '@angular-day/contracts';

type SlotPickerData = Extract<AgentInteraction, { interaction: 'appointment-slot-picker' }>['data'];

@Component({
  selector: 'app-appointment-slot-picker',
  templateUrl: './appointment-slot-picker.component.html',
  styleUrl: './appointment-slot-picker.component.scss',
})
export class AppointmentSlotPicker {
  readonly data = input.required<SlotPickerData>();
  readonly action = output<ClientAction>();

  choose(slotId: string): void {
    this.action.emit({ type: 'slot-selected', slotId });
  }
}
