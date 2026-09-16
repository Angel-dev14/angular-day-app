import { Component, input } from '@angular/core';
import type { ActivityItem } from '@angular-day/contracts';

@Component({
  selector: 'app-agent-activity',
  templateUrl: './agent-activity.component.html',
  styleUrl: './agent-activity.component.scss',
})
export class AgentActivity {
  readonly activity = input.required<ActivityItem[]>();
  readonly mode = input.required<'live' | 'demo' | 'fallback'>();
  readonly lastEvent = input.required<string>();
  readonly eventCount = input.required<number>();
}
