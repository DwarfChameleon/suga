import { Component, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { Order } from 'src/app/interface/order';
import { UserDashboardService } from 'src/app/services/userdashboard.service';
import { UiFeedbackService } from 'src/app/services/ui-feedback.service';
import { OrderInfoComponent } from '../order-info/order-info.component';

@Component({
  selector: 'app-order-history',
  templateUrl: './order-history.component.html',
  styleUrls: ['./order-history.component.scss']
})
export class OrderHistoryComponent implements OnInit {
  orders: Order[] = [];
  isLoading = false;

  constructor(
    private readonly userDashboardService: UserDashboardService,
    private readonly uiFeedback: UiFeedbackService,
    private readonly modalController: ModalController
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.isLoading = true;
    this.userDashboardService.getUserOrders().subscribe({
      next: (orders) => {
        this.orders = this.sortNewestFirst((orders || []).filter((order) =>
          ['confirmed', 'declined', 'processing', 'delivered', 'completed', 'cancelled', 'approved', 'placed'].includes(order.status)
        ));
        this.isLoading = false;
      },
      error: () => {
        this.orders = [];
        this.isLoading = false;
        this.uiFeedback.error('Could not load order history.');
      }
    });
  }

  async openOrder(orderId: string): Promise<void> {
    const modal = await this.modalController.create({
      component: OrderInfoComponent,
      componentProps: { orderId },
      cssClass: 'suga-order-fullsheet'
    });
    await modal.present();
  }

  trackByOrder(_index: number, order: Order): string {
    return order._id;
  }

  private sortNewestFirst(orders: Order[]): Order[] {
    return [...orders].sort((a, b) => {
      const aTime = new Date(a.orderTime || 0).getTime();
      const bTime = new Date(b.orderTime || 0).getTime();
      return bTime - aTime;
    });
  }
}
