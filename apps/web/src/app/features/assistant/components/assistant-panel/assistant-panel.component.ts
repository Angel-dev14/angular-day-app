import { Component, inject, signal } from '@angular/core';
import { FormField, form, required, submit } from '@angular/forms/signals';
import { AgentClient } from '../../../../core/ag-ui/agent-client.service';

@Component({
  selector: 'app-assistant-panel',
  imports: [FormField],
  templateUrl: './assistant-panel.component.html',
  styleUrl: './assistant-panel.component.scss',
})
export class AssistantPanel {
  protected readonly agent = inject(AgentClient);
  protected readonly messageModel = signal({
    message: "Move John's appointment to Monday afternoon.",
  });
  protected readonly messageForm = form(this.messageModel, (path) => {
    required(path.message, { message: 'Enter a goal for the agent.' });
  });

  send(): void {
    submit(this.messageForm, async () => {
      await this.agent.sendGoal(this.messageModel().message);
    });
  }
}
