export interface ExportMessageRow {
  createdAt: Date;
  senderShopName: string;
  messageType: string;
  content?: string;
  imageUrl?: string;
}
