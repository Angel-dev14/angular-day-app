import type { Appointment, AppointmentDetails, AppointmentSlot, Patient } from '@angular-day/contracts';

const initialAppointment: Appointment = {
  id: 'appointment-001',
  patientId: 'patient-001',
  patientName: 'John Smith',
  day: 'Friday',
  time: '10:30',
};

const patient: Patient = { id: 'patient-001', name: 'John Smith' };

const mondaySlots: AppointmentSlot[] = [
  { id: 'slot-mon-1300', day: 'Monday', time: '13:00', available: true },
  { id: 'slot-mon-1430', day: 'Monday', time: '14:30', available: true },
  { id: 'slot-mon-1600', day: 'Monday', time: '16:00', available: true },
];

const details: Omit<AppointmentDetails, 'day' | 'time'> = {
  appointmentId: 'appointment-001',
  clinician: 'Dr. Maya Chen',
  specialty: 'Cardiology',
  visitType: 'Follow-up consultation',
  location: 'Riverside Clinic · Room 204',
  durationMinutes: 30,
  reason: 'Routine cardiac follow-up',
};

let appointment = structuredClone(initialAppointment);

export const mockStore = {
  searchPatient(query: string): Patient | null {
    return patient.name.toLowerCase().includes(query.toLowerCase()) ? structuredClone(patient) : null;
  },

  getAppointments(patientId: string): Appointment[] {
    return appointment.patientId === patientId ? [structuredClone(appointment)] : [];
  },

  getAvailableSlots(window: string): AppointmentSlot[] {
    return window.toLowerCase().includes('monday') ? structuredClone(mondaySlots) : [];
  },

  getAppointmentDetails(appointmentId: string): AppointmentDetails {
    if (appointment.id !== appointmentId) {
      throw new Error('Appointment details not found.');
    }
    return structuredClone({ ...details, day: appointment.day, time: appointment.time });
  },

  rescheduleAppointment(appointmentId: string, slotId: string): Appointment {
    if (appointment.id !== appointmentId) {
      throw new Error('Appointment not found.');
    }

    const slot = mondaySlots.find((candidate) => candidate.id === slotId && candidate.available);
    if (!slot) {
      throw new Error('That appointment slot is no longer available.');
    }

    appointment = { ...appointment, day: slot.day, time: slot.time };
    return structuredClone(appointment);
  },

  currentAppointment(): Appointment {
    return structuredClone(appointment);
  },

  reset(): Appointment {
    appointment = structuredClone(initialAppointment);
    return structuredClone(appointment);
  },
};
