import { Component, Input, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { Router } from '@angular/router';
import { Order } from 'src/app/interface/order';
import { OrderService } from 'src/app/services/order.service';
import { TokenStorageService } from 'src/app/services/token-storage.service';

@Component({
  selector: 'app-payment-success-sheet',
  templateUrl: './payment-success-sheet.component.html',
  styleUrls: ['./payment-success-sheet.component.scss']
})
export class PaymentSuccessSheetComponent implements OnInit {
  @Input() orderId = '';
  @Input() orderIds: string[] = [];
  @Input() paymentProvider = '';

  order: Order | null = null;
  isLoading = false;

  constructor(
    private readonly modalController: ModalController,
    private readonly orderService: OrderService,
    private readonly tokenStorage: TokenStorageService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.orderId = this.orderId || this.orderIds?.[0] || '';
    if (!this.orderId) return;
    this.isLoading = true;
    this.orderService.getOrderById(this.orderId).subscribe({
      next: (order) => {
        this.order = order;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  get title(): string {
    return this.paymentProvider === 'paystack' ? 'Paystack payment successful' : 'Payment successful';
  }

  get statusText(): string {
    const status = String(this.order?.status || 'placed').replace(/_/g, ' ');
    const dispatch = String(this.order?.dispatchStatus || '');
    if (dispatch && dispatch !== 'unassigned') {
      return `${status} · dispatch ${dispatch.replace(/_/g, ' ')}`;
    }
    return status;
  }

  async viewDashboard(): Promise<void> {
    const roles = (this.tokenStorage.getRoles() || []).map((role) => String(role || '').toLowerCase());
    const route = roles.includes('chef')
      ? '/components/chef'
      : roles.includes('dispatch')
        ? '/components/dispatch'
        : '/components/consumer';
    const queryParams = roles.includes('chef') ? { tab: 'orders' } : undefined;
    await this.modalController.dismiss({ viewDashboard: true });
    await this.router.navigate([route], {
      queryParams,
      state: { activeOrderId: this.orderId, openLiveOrder: true }
    });
  }

  close(): void {
    this.modalController.dismiss();
  }
}
