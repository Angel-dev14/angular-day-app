import { Component, input } from '@angular/core';
import type { AppointmentDetails as AppointmentDetailsData } from '@angular-day/contracts';

@Component({
  selector: 'app-appointment-details',
  templateUrl: './appointment-details.component.html',
  styleUrl: './appointment-details.component.scss',
})
export class AppointmentDetails {
  readonly details = input.required<AppointmentDetailsData>();
}
