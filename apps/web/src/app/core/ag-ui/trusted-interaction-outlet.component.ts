import {
  Component,
  type ComponentRef,
  effect,
  input,
  output,
  type Type,
  viewChild,
  ViewContainerRef,
} from '@angular/core';
import type { AgentInteraction, ClientAction } from '@angular-day/contracts';
import { AppointmentSlotPicker } from '../../features/appointments/components/appointment-slot-picker/appointment-slot-picker.component';
import { Confirmation } from '../../features/appointments/components/confirmation/confirmation.component';

type TrustedInstance = {
  action: { subscribe: (handler: (action: ClientAction) => void) => { unsubscribe(): void } };
};

// Security boundary: only these locally compiled Angular components can be rendered.
export const TRUSTED_INTERACTION_COMPONENTS: Record<AgentInteraction['interaction'], Type<unknown>> = {
  'appointment-slot-picker': AppointmentSlotPicker,
  confirmation: Confirmation,
};

@Component({
  selector: 'app-trusted-interaction-outlet',
  template: '<ng-container #host />',
})
export class TrustedInteractionOutlet {
  readonly interaction = input<AgentInteraction | null>(null);
  readonly action = output<ClientAction>();
  private readonly host = viewChild('host', { read: ViewContainerRef });

  constructor() {
    effect((onCleanup) => {
      const host = this.host();
      const interaction = this.interaction();
      if (!host) return;
      host.clear();
      if (!interaction) return;

      const componentType = TRUSTED_INTERACTION_COMPONENTS[interaction.interaction];
      if (!componentType) return;
      const ref: ComponentRef<unknown> = host.createComponent(componentType);
      ref.setInput('data', interaction.data);
      const subscription = (ref.instance as TrustedInstance).action.subscribe((action) => this.action.emit(action));
      onCleanup(() => subscription.unsubscribe());
    });
  }
}
