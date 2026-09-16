import { mockStore } from '../data/mock-store.js';

export const appointmentTools = {
  searchPatient: (name: string) => mockStore.searchPatient(name),
  getAppointments: (patientId: string) => mockStore.getAppointments(patientId),
  getAppointmentDetails: (appointmentId: string) => mockStore.getAppointmentDetails(appointmentId),
  getAvailableSlots: (window: string) => mockStore.getAvailableSlots(window),
  rescheduleAppointment: (appointmentId: string, slotId: string) =>
    mockStore.rescheduleAppointment(appointmentId, slotId),
};

export type AppointmentToolName = keyof typeof appointmentTools;
