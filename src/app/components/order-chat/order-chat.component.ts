import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { OrderChatMessage, OrderChatService } from 'src/app/services/order-chat.service';
import { NotificationSocketService } from 'src/app/services/notification-socket.service';
import { UiFeedbackService } from 'src/app/services/ui-feedback.service';

@Component({
  selector: 'app-order-chat',
  templateUrl: './order-chat.component.html',
  styleUrls: ['./order-chat.component.scss']
})
export class OrderChatComponent implements OnInit, OnDestroy {
  @Input() orderId = '';
  @Input() dishName = 'Order';
  @Input() trackingNumber = '';

  messages: OrderChatMessage[] = [];
  messageText = '';
  available = false;
  locked = false;
  isLoading = false;
  isSending = false;
  private unsubscribeMessage?: () => void;
  private unsubscribeLocked?: () => void;

  constructor(
    private modalController: ModalController,
    private orderChatService: OrderChatService,
    private notificationSocket: NotificationSocketService,
    private uiFeedback: UiFeedbackService
  ) {}

  ngOnInit(): void {
    this.loadChat();
    this.notificationSocket.emit('order-chat:join', { orderId: this.orderId });
    this.unsubscribeMessage = this.notificationSocket.on<any>('order-chat:new-message', (payload) => {
      if (String(payload?.orderId || '') !== String(this.orderId)) return;
      const incoming = payload?.message as OrderChatMessage;
      if (!incoming) return;
      const id = String(incoming?._id || '');
      if (id && this.messages.some((message) => String(message?._id || '') === id)) return;
      this.messages = [...this.messages, incoming];
      this.locked = !!payload?.locked;
      this.scrollToBottom();
    });
    this.unsubscribeLocked = this.notificationSocket.on<any>('order-chat:locked', (payload) => {
      if (String(payload?.orderId || '') === String(this.orderId)) {
        this.locked = true;
      }
    });
  }

  ngOnDestroy(): void {
    this.unsubscribeMessage?.();
    this.unsubscribeLocked?.();
  }

  loadChat(): void {
    if (!this.orderId) return;
    this.isLoading = true;
    this.orderChatService.getChat(this.orderId).subscribe({
      next: (chat) => {
        this.available = !!chat.available;
        this.locked = !!chat.locked;
        this.messages = chat.messages || [];
        if (this.available) {
          this.notificationSocket.emit('order-chat:join', { orderId: this.orderId });
        }
        this.isLoading = false;
        this.scrollToBottom();
      },
      error: (error) => {
        this.isLoading = false;
        this.uiFeedback.error(error?.error?.message || 'Could not load order chat.');
      }
    });
  }

  sendMessage(): void {
    const text = this.messageText.trim();
    if (!text || this.locked || this.isSending) return;
    this.isSending = true;
    this.orderChatService.sendMessage(this.orderId, text).subscribe({
      next: (response) => {
        this.isSending = false;
        this.messageText = '';
        this.locked = !!response.locked;
        const saved = response.message;
        const id = String(saved?._id || '');
        if (!id || !this.messages.some((message) => String(message?._id || '') === id)) {
          this.messages = [...this.messages, saved];
        }
        this.scrollToBottom();
      },
      error: (error) => {
        this.isSending = false;
        this.uiFeedback.error(error?.error?.message || 'Could not send message.');
      }
    });
  }

  close(): void {
    this.modalController.dismiss();
  }

  trackByMessage(index: number, message: OrderChatMessage): string {
    return String(message?._id || `${message.createdAt}-${index}`);
  }

  private scrollToBottom(): void {
    window.setTimeout(() => {
      const list = document.querySelector('.order-chat-messages');
      if (list) list.scrollTop = list.scrollHeight;
    }, 80);
  }
}
