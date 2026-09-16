import { Component, inject } from '@angular/core';
import { AgentClient } from './core/ag-ui/agent-client.service';
import { TrustedInteractionOutlet } from './core/ag-ui/trusted-interaction-outlet.component';
import { AppointmentDetails } from './features/appointments/components/appointment-details/appointment-details.component';
import { AppointmentSummary } from './features/appointments/components/appointment-summary/appointment-summary.component';
import { AgentActivity } from './features/assistant/components/agent-activity/agent-activity.component';
import { AssistantPanel } from './features/assistant/components/assistant-panel/assistant-panel.component';

@Component({
  selector: 'app-root',
  imports: [AppointmentSummary, AppointmentDetails, AgentActivity, AssistantPanel, TrustedInteractionOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class App {
  protected readonly agent = inject(AgentClient);
}
