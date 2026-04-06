import { Component, OnInit } from '@angular/core';
import { TokenStorageService } from 'src/app/services/token-storage.service';
import { Router } from '@angular/router';
import { ChefDashboardService } from 'src/app/services/chefdashboard.service';
import { Order } from 'src/app/interface/order';
import { OrderService } from 'src/app/services/order.service';
import { OrderInfoComponent } from '../order-info/order-info.component';
import { UserService } from 'src/app/services/user.service';
import { ModalController } from '@ionic/angular';

@Component({
  selector: 'app-chef-orders',
  templateUrl: './chef-orders.component.html',
  styleUrls: ['./chef-orders.component.scss'],
})
export class ChefOrdersComponent  implements OnInit {
  orders: Order[] = [];
  historyOrders: Order[] = [];
  isLoading = false;
  tokenStorageService: any;
  errorMessage: string | undefined;
  promptMessage: string | undefined;
  constructor(
    private orderService: OrderService,
        private tokenStorage: TokenStorageService,
        private router: Router,
        private modalController: ModalController,
        private userService: UserService,
        private chefDashboardService: ChefDashboardService
  ) { }

  ngOnInit() {
    this.loadOrders();
  }

   fetchChefOrders(): void {
    this.isLoading = true;
    this.chefDashboardService.getChefOrders().subscribe(
      (orders) => {
        if (orders.length === 0) {
          this.orders = [];
          this.historyOrders = [];
          this.errorMessage = 'You have not received any orders.';
        } else {
          this.orders = this.sortOrdersByRecent(orders);
          this.historyOrders = this.orders.filter((order) => this.isHistoryStatus(order.status));
          this.errorMessage = undefined;
        }
        this.isLoading = false;
      },
      (error) => {
        console.error('Error fetching chef orders:', error);
        this.errorMessage = 'Order unavailable. Please try again later.';
        this.isLoading = false;
      }
    );
  }
  

  loadOrders() {
    this.fetchChefOrders();
  }
  
///update order status


  updateOrderStatus(order: Order, status: string) {
    if (!order._id) {
      console.error('Order ID is undefined');
      return;
    }
  
    this.chefDashboardService.updateOrderStatus(order._id, status).subscribe(
          (_updatedOrder: Order) => {
        this.loadOrders(); // Refresh orders list after updating the status
      },
      (error) => {
        console.error('Error updating order status:', error);
      }
    );
  }

      ///order details model
  async openModalOrder(orderId: string) {
    // Call fetchFood only when opening the modal
    this.fetchOrder(orderId);

    const modal = await this.modalController.create({
      component: OrderInfoComponent,
      componentProps: { orderId }
    });
    await modal.present();
  }
  fetchOrder(orderId: string) {
    this.orderService.getOrderById(orderId).subscribe(
      (order) => {
        console.log('Fetched order:', order);
      },
      (error) => {
        console.error('Error fetching order:', error);
      }
    );
  }

  private isHistoryStatus(status: Order['status']): boolean {
    return ['completed', 'declined', 'cancelled', 'placed'].includes(status);
  }

  private sortOrdersByRecent(orders: Order[]): Order[] {
    return [...orders].sort((a, b) => {
      const aTime = a.orderTime ? new Date(a.orderTime).getTime() : 0;
      const bTime = b.orderTime ? new Date(b.orderTime).getTime() : 0;
      return bTime - aTime;
    });
  }

}
