import { z } from 'zod';

export const patientSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export const appointmentSchema = z.object({
  id: z.string(),
  patientId: z.string(),
  patientName: z.string(),
  day: z.string(),
  time: z.string(),
});

export const appointmentDetailsSchema = z.object({
  appointmentId: z.string(),
  day: z.string(),
  time: z.string(),
  clinician: z.string(),
  specialty: z.string(),
  visitType: z.string(),
  location: z.string(),
  durationMinutes: z.number().int().positive(),
  reason: z.string(),
});

export const slotSchema = z.object({
  id: z.string(),
  day: z.string(),
  time: z.string(),
  available: z.boolean(),
});

export const activityStatusSchema = z.enum([
  'running',
  'complete',
  'waiting',
  'error',
]);

export const activityItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  status: activityStatusSchema,
});

export const interactionSchema = z.discriminatedUnion('interaction', [
  z.object({
    interaction: z.literal('appointment-slot-picker'),
    data: z.object({
      prompt: z.string(),
      slots: z.array(slotSchema),
    }),
  }),
  z.object({
    interaction: z.literal('confirmation'),
    data: z.object({
      appointmentId: z.string(),
      slotId: z.string(),
      patientName: z.string(),
      fromDay: z.string(),
      fromTime: z.string(),
      toDay: z.string(),
      toTime: z.string(),
    }),
  }),
]);

export const workflowPhaseSchema = z.enum([
  'idle',
  'working',
  'details-shown',
  'awaiting-slot',
  'awaiting-confirmation',
  'complete',
  'error',
]);

export const agentModeSchema = z.enum(['live', 'demo', 'fallback']);

export const demoStateSchema = z.object({
  patient: patientSchema.nullable(),
  appointment: appointmentSchema,
  appointmentDetails: appointmentDetailsSchema.nullable(),
  slots: z.array(slotSchema),
  interaction: interactionSchema.nullable(),
  activity: z.array(activityItemSchema),
  phase: workflowPhaseSchema,
  mode: agentModeSchema,
  error: z.string().nullable(),
});

export const clientActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('slot-selected'),
    slotId: z.string(),
  }),
  z.object({
    type: z.literal('reschedule-confirmed'),
    appointmentId: z.string(),
    slotId: z.string(),
  }),
  z.object({
    type: z.literal('reschedule-cancelled'),
  }),
]);

export type Patient = z.infer<typeof patientSchema>;
export type Appointment = z.infer<typeof appointmentSchema>;
export type AppointmentDetails = z.infer<typeof appointmentDetailsSchema>;
export type AppointmentSlot = z.infer<typeof slotSchema>;
export type ActivityItem = z.infer<typeof activityItemSchema>;
export type AgentInteraction = z.infer<typeof interactionSchema>;
export type DemoState = z.infer<typeof demoStateSchema>;
export type ClientAction = z.infer<typeof clientActionSchema>;
