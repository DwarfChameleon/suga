export interface AppNotification {
  _id: string;
  recipientId?: string;
  recipientRole?: string;
  type: string;
  title: string;
  message: string;
  data?: any;
  read: boolean;
  createdAt: string;
}
