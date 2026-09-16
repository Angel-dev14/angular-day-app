import { TestBed } from '@angular/core/testing';
import { AppointmentDetails } from './appointment-details.component';

describe('AppointmentDetails', () => {
  it('renders the scheduled day and time from trusted tool state', async () => {
    const fixture = TestBed.createComponent(AppointmentDetails);
    fixture.componentRef.setInput('details', {
      appointmentId: 'appointment-001',
      day: 'Friday',
      time: '10:30',
      clinician: 'Dr. Maya Chen',
      specialty: 'Cardiology',
      visitType: 'Follow-up consultation',
      location: 'Riverside Clinic · Room 204',
      durationMinutes: 30,
      reason: 'Routine cardiac follow-up',
    });

    await fixture.whenStable();

    const text = (fixture.nativeElement as HTMLElement).textContent;
    expect(text).toContain('Scheduled date');
    expect(text).toContain('Friday');
    expect(text).toContain('Scheduled time');
    expect(text).toContain('10:30');
  });
});
