export const CHAT_ERROR_CODES = {
  CONVERSATION_NOT_FOUND: 'CONVERSATION_NOT_FOUND',
  NOT_PARTICIPANT: 'NOT_PARTICIPANT',
  MESSAGE_NOT_FOUND: 'MESSAGE_NOT_FOUND',
  INVALID_TARGET: 'INVALID_TARGET',
  INVALID_IMAGE_URL: 'INVALID_IMAGE_URL',
} as const;

export type ChatErrorCode = (typeof CHAT_ERROR_CODES)[keyof typeof CHAT_ERROR_CODES];

export class ChatValidationError extends Error {
  constructor(
    message: string,
    readonly code: ChatErrorCode,
  ) {
    super(message);
    this.name = 'ChatValidationError';
  }
}
