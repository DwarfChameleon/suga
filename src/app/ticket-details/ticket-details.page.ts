import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ActionSheetController, AlertController, IonicModule, NavController } from '@ionic/angular';
import { SupportTicket } from '../services/support-ticket.service';
import { CustomerSupportService } from '../services/customer-support.service';
import { SupportSocketService } from '../services/support-socket.service';

type Sender = 'CUSTOMER' | 'AGENT' | 'SYSTEM';
interface SupportMessage { id: string; sender: Sender; senderName?: string; text: string; time: string; read?: boolean; image?: string; }

@Component({ selector: 'app-ticket-details', standalone: true, imports: [CommonModule, FormsModule, IonicModule], templateUrl: './ticket-details.page.html', styleUrls: ['./ticket-details.page.scss'] })
export class TicketDetailsPage implements OnInit, OnDestroy {
  ticket: SupportTicket = { ticketNumber: '', subject: 'Support request', category: 'General Support', status: 'OPEN', priority: 'NORMAL', lastResponse: 'Just now', lastResponseAt: new Date().toISOString(), unread: false };
  messages: SupportMessage[] = [];
  messageText = ''; selectedImage: string | null = null; selectedFile: File | null = null; agentTyping = false;
  private typingTimer?: ReturnType<typeof setTimeout>;
  private typingActive = false;
  constructor(private route: ActivatedRoute, private nav: NavController, private tickets: CustomerSupportService, private socket: SupportSocketService, private alerts: AlertController, private actions: ActionSheetController) {}
  ngOnInit(): void {
    const number = this.route.snapshot.paramMap.get('ticketNumber') || '';
    this.ticket.ticketNumber = number;
    this.tickets.getTicket(number).subscribe({ next: response => { const data = response.data || {}; this.ticket = { ...this.ticket, ...(data.ticket || data), orderId: (data.ticket || data).orderReference }; this.messages = (data.messages || []).map((m: any) => this.mapMessage(m)); this.socket.joinTicket(number); this.socket.markRead(number); this.tickets.markTicketRead(number).subscribe(); }, error: () => this.showMessage('Unable to load this ticket right now.') });
    this.socket.messages$.subscribe((m: any) => { const message = m.data || m.message || m; if (message.ticketNumber === number || m.ticketNumber === number || !message.ticketNumber) { const mapped = this.mapMessage(message); if (!this.messages.some(x => x.id === mapped.id)) this.messages.push(mapped); } });
    this.socket.typing$.subscribe((m: any) => { this.agentTyping = !!m.isTyping; });
    this.socket.read$.subscribe((m: any) => { if (m.ticketNumber === number && m.userType === 'SUPPORT_AGENT') this.messages.forEach(message => message.read = true); });
  }
  ngOnDestroy(): void { if (this.typingTimer) clearTimeout(this.typingTimer); this.socket.leaveTicket(this.ticket.ticketNumber); }
  private mapMessage(m: any): SupportMessage { return { id: m._id || m.id || m.clientMessageId || `${Date.now()}-${Math.random()}`, sender: m.senderType === 'CUSTOMER' ? 'CUSTOMER' : m.senderType === 'SYSTEM' ? 'SYSTEM' : 'AGENT', senderName: m.senderName || undefined, text: m.text || '', time: m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : this.time(), read: !!m.read }; }
  time(): string { return new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }
  get statusClass(): string { return `status-${this.ticket.status.toLowerCase().replace(/_/g, '-')}`; }
  getStatusLabel(status: string): string { return ({ OPEN: 'Open', IN_PROGRESS: 'In Progress', WAITING_FOR_CUSTOMER: 'Waiting for You', RESOLVED: 'Resolved', CLOSED: 'Closed' } as Record<string, string>)[status] || status; }
  getCategoryIcon(category: string): string { return ({ 'Order Assistance': 'bag-handle-outline', 'Delivery Support': 'bicycle-outline', 'Payment Issues': 'card-outline', 'Chef Assistance': 'restaurant-outline', 'Account Support': 'person-outline', 'Rewards Support': 'gift-outline' } as Record<string, string>)[category] || 'help-circle-outline'; }
  goBack(): void { this.nav.back(); }
  canSend(): boolean { return !!this.messageText.trim() || !!this.selectedFile; }
  handleEnter(event: Event): void { const keyboard = event as KeyboardEvent; if (!keyboard.shiftKey) { keyboard.preventDefault(); this.sendMessage(); } }
  sendMessage(): void { if (!this.canSend() || this.ticket.status === 'CLOSED') return; const form = new FormData(); form.append('text', this.messageText.trim()); form.append('clientMessageId', (globalThis.crypto as any)?.randomUUID?.() || `${Date.now()}-${Math.random()}`); if (this.selectedFile) form.append('attachments', this.selectedFile, this.selectedFile.name); this.tickets.sendMessage(this.ticket.ticketNumber, form).subscribe({ next: r => { const m = r.data; if (m && !this.messages.some(x => x.id === (m._id || m.id))) this.messages.push(this.mapMessage(m)); this.messageText = ''; this.selectedImage = null; this.selectedFile = null; }, error: () => this.showMessage('Message could not be sent.') }); }
  handleTyping(): void { this.socket.setTyping(this.ticket.ticketNumber, true); this.typingActive = true; if (this.typingTimer) clearTimeout(this.typingTimer); this.typingTimer = setTimeout(() => { this.socket.setTyping(this.ticket.ticketNumber, false); this.typingActive = false; }, 900); }
  selectAttachment(): void { const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/png,image/jpeg,image/webp,application/pdf'; input.onchange = () => { const file = input.files?.[0]; if (!file || file.size > 10 * 1024 * 1024) return; this.selectedFile = file; const reader = new FileReader(); reader.onload = () => this.selectedImage = reader.result as string; reader.readAsDataURL(file); }; input.click(); }
  removeAttachment(): void { this.selectedImage = null; this.selectedFile = null; }
  async openTicketMenu(): Promise<void> { const sheet = await this.actions.create({ header: `Ticket #${this.ticket.ticketNumber}`, buttons: [{ text: 'Mark as resolved', icon: 'checkmark-circle-outline', handler: () => this.resolveTicket() }, { text: 'Close ticket', icon: 'close-circle-outline', role: 'destructive', handler: () => this.closeTicket() }, { text: 'Cancel', role: 'cancel' }] }); await sheet.present(); }
  resolveTicket(): void { void this.nav.navigateForward(`/support/ticket-action/${this.ticket.ticketNumber}/resolve`); }
  reopenTicket(): void { void this.nav.navigateForward(`/support/ticket-action/${this.ticket.ticketNumber}/reopen`); }
  closeTicket(): void { void this.nav.navigateForward(`/support/ticket-action/${this.ticket.ticketNumber}/close`); }
  private async showMessage(message: string): Promise<void> { const alert = await this.alerts.create({ header: 'SUGA Support', message, buttons: ['OK'] }); await alert.present(); }
}
