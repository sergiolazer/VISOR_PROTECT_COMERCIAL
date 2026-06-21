import type {
  ExplainShopFilterParams,
  FindEligibleRecipientsParams,
  RecipientResolutionResult,
  AlertRecipientRecord,
} from '../entities/AlertRecipient';
import type { AlertFilterRejection } from '@visor-protect/shared';

export interface IAlertRecipientRepository {
  findEligibleRecipients(params: FindEligibleRecipientsParams): Promise<AlertRecipientRecord[]>;
  resolveRecipientsWithAudit(params: FindEligibleRecipientsParams): Promise<RecipientResolutionResult>;
  explainShopFilter(params: ExplainShopFilterParams): Promise<AlertFilterRejection | null>;
}
