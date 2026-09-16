import { Component, input } from '@angular/core';
import type { Appointment } from '@angular-day/contracts';

@Component({
  selector: 'app-appointment-summary',
  templateUrl: './appointment-summary.component.html',
  styleUrl: './appointment-summary.component.scss',
})
export class AppointmentSummary {
  readonly appointment = input.required<Appointment>();
}
