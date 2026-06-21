import type { AlertDispatchMessage } from '@visor-protect/shared';

export type AlertDeliveryHandler = (message: AlertDispatchMessage) => Promise<void>;

export interface IAlertBroker {
  publish(message: AlertDispatchMessage): Promise<void>;
  subscribe(handler: AlertDeliveryHandler): Promise<void>;
  disconnect(): Promise<void>;
}
