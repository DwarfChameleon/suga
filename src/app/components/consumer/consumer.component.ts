import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from 'src/app/services/authservice.service';
import { TokenStorageService } from 'src/app/services/token-storage.service';
import { UserInfo } from 'src/app/interface/user-details';
import { UserDashboardService } from 'src/app/services/userdashboard.service';
import { Order } from 'src/app/interface/order';
import { NetworkService } from 'src/app/services/network.service';
import { UiFeedbackService } from 'src/app/services/ui-feedback.service';
import { AlertController, ModalController } from '@ionic/angular';
import { OrderInfoComponent } from '../order-info/order-info.component';
import { OrderRatingComponent } from '../order-rating/order-rating.component';
import { UserService } from 'src/app/services/user.service';
import { OrderChatComponent } from '../order-chat/order-chat.component';
@Component({
  selector: 'app-consumer',
  templateUrl: './consumer.component.html',
  styleUrls: ['./consumer.component.scss'],
})
export class ConsumerComponent implements OnInit {
  userProfile: UserInfo | undefined;
  profileDetails: any = null;
  selectedSegment: string = 'liveOrder';
  orders: Order[] = [];
  orderHistory: Order[] = [];
  liveOrders: Order[] = [];
  completedOrders: Order[] = [];
  deliveredOrders: Order[] = [];
  processingOrders: Order[] = [];
  isLoadingOrders = false;
  isOnline = true;
  private promptedDeliveredOrderIds = new Set<string>();
  private promptedRatingIds = new Set<string>();
  private ratingsInitialized = false;
  private completedSeen = new Set<string>();
  private pendingOpenOrderId = '';
  private openedStateOrder = false;
  focusedOrderId = '';

  constructor(
    private authService: AuthService,
    private tokenStorage: TokenStorageService,
    private router: Router,
    private route: ActivatedRoute,
    private userDashboardService: UserDashboardService,
    private networkService: NetworkService,
    private uiFeedback: UiFeedbackService,
    private alertController: AlertController,
    private modalController: ModalController,
    private userService: UserService
  ) {}
  

  segmentChanged(event: any) {
    this.selectedSegment = event.detail.value;
  }
  ngOnInit(): void {
    const stateOrderId = String(history?.state?.activeOrderId || '');
    const requestedTab = String(this.route.snapshot.queryParamMap.get('tab') || history?.state?.selectedSegment || '');
    if (['liveOrder', 'completedOrders'].includes(requestedTab)) {
      this.selectedSegment = requestedTab;
    }
    if (stateOrderId) {
      this.pendingOpenOrderId = stateOrderId;
      this.selectedSegment = 'liveOrder';
    }
    this.loadUserProfile();
    this.loadProfileDetails();
    this.fetchUserOrders();
    this.networkService.online$.subscribe((online) => {
      this.isOnline = online;
    });
  }

  refresh(event: any): void {
    this.loadUserProfile();
    this.loadProfileDetails();
    this.fetchUserOrders();
    const refresher = event?.target as HTMLIonRefresherElement | null;
    setTimeout(() => refresher?.complete(), 700);
  }
  //user orders
  fetchUserOrders(): void {
    this.isLoadingOrders = true;
    this.userDashboardService.getUserOrders().subscribe(
      (orders) => {
        this.orders = this.sortNewestFirst(orders || []);
        this.categorizeOrders();
        this.promptDeliveryConfirmationForPending();
        this.promptRatingIfNeeded();
        this.openPendingOrderFromState();
        this.isLoadingOrders = false;
      },
      (error) => {
        console.error('Error fetching user orders:', error);
        this.uiFeedback.error('Could not load orders right now.');
        this.isLoadingOrders = false;
      }
    );
  }

  categorizeOrders(): void {
    this.orderHistory = this.orders.filter((order) =>
      order.status === 'confirmed' ||
      order.status === 'declined' ||
      order.status === 'processing' ||
      order.status === 'delivered' ||
      order.status === 'completed'
    );
    this.liveOrders = this.orders.filter((order) =>
      order.status === 'placed' ||
      order.status === 'confirmed' ||
      order.status === 'approved' ||
      order.status === 'processing' ||
      order.status === 'delivered'
    );
    this.completedOrders = this.orders.filter((order) => order.status === 'completed');
    this.deliveredOrders = this.orders.filter((order) => order.status === 'delivered');
    this.processingOrders= this.orders.filter((order)=> order.status === 'processing');
  }

  ///enduser orders
  updateProfile():void{
    this.router.navigate(['components/edit-profile']);
  }

  openSettings(): void {
    this.router.navigate(['components/profile-update']);
  }
  loadUserProfile(): void {
    this.userProfile = this.tokenStorage.getUser();
    if (!this.userProfile) {
      console.error('No user profile available. User is not authenticated.');
    }
  }

  loadProfileDetails(): void {
    this.userService.getEditableProfile().subscribe({
      next: (profile) => {
        this.profileDetails = profile;
      },
      error: () => {}
    });
  }

  newOrder(){
    this.router.navigate(['/components/explore/'])
  }

  openOrdersHistory(): void {
    this.router.navigate(['/components/order-history']);
  }

  openNotifications(): void {
    this.router.navigate(['components/notifications']);
  }
  openWallet(): void {
    this.router.navigate(['components/wallet']);
  }
  openRewards(): void {
    this.router.navigate(['components/rewards']);
  }

  confirmReceipt(order: Order, received: boolean): void {
    if (!order?._id) return;
    this.userDashboardService.confirmOrderReceipt(order._id, received).subscribe({
      next: () => {
        this.uiFeedback.success(received ? 'Order confirmed. Chef payout released.' : 'Marked not received. System will review.');
        this.promptedDeliveredOrderIds.delete(order._id);
        this.fetchUserOrders();
      },
      error: (error) => {
        console.error('Error confirming receipt:', error);
        this.uiFeedback.error('Unable to confirm receipt right now.');
      }
    });
  }

  private async promptDeliveryConfirmationForPending(): Promise<void> {
    const pendingDeliveredOrders = this.orders.filter((order) =>
      order.status === 'delivered' &&
      order.payoutStatus === 'awaiting_consumer_confirmation' &&
      !!order._id &&
      !this.promptedDeliveredOrderIds.has(order._id)
    );

    for (const order of pendingDeliveredOrders) {
      this.promptedDeliveredOrderIds.add(order._id);
      const alert = await this.alertController.create({
        header: 'Delivery Confirmation',
        subHeader: order.dishName,
        message: 'Chef marked this order as sent. Please confirm if you received it.',
        buttons: [
          {
            text: 'Not Delivered',
            role: 'cancel',
            handler: () => this.confirmReceipt(order, false)
          },
          {
            text: 'Confirm Delivery',
            handler: () => this.confirmReceipt(order, true)
          }
        ]
      });
      await alert.present();
    }
  }

  private async promptRatingIfNeeded(): Promise<void> {
    const completedOrders = this.orders.filter((order) => order.status === 'completed');
    if (!this.ratingsInitialized) {
      completedOrders.forEach((o) => o._id && this.completedSeen.add(o._id));
      this.ratingsInitialized = true;
      return;
    }

    const newlyCompleted = completedOrders.find(
      (order) => !!order._id && !this.completedSeen.has(order._id) && !this.hasRated(order)
    );
    if (!newlyCompleted?._id || this.promptedRatingIds.has(newlyCompleted._id)) return;
    this.completedSeen.add(newlyCompleted._id);
    this.promptedRatingIds.add(newlyCompleted._id);
    const modal = await this.modalController.create({
      component: OrderRatingComponent,
      componentProps: { orderId: newlyCompleted._id, dishName: newlyCompleted.dishName }
    });
    await modal.present();
    await modal.onDidDismiss();
  }

  private hasRated(order: Order): boolean {
    const ratings = Array.isArray(order?.ratings) ? order.ratings : [];
    return ratings.some((r: any) => r.role === 'consumer');
  }

  logout(): void {
    this.tokenStorage.signOut();
    this.router.navigate(['/login']);
  }

  async viewOrderDetails(order: Order): Promise<void> {
    if (!order?._id) return;

    const modal = await this.modalController.create({
      component: OrderInfoComponent,
      componentProps: { orderId: order._id },
      cssClass: 'suga-order-fullsheet'
    });
    await modal.present();
    const result = await modal.onDidDismiss();
    const focusOrderId = String(result?.data?.focusOrderId || '').trim();
    if (focusOrderId) {
      this.focusOrderCard(focusOrderId);
    } else if (result?.data?.changed) {
      this.fetchUserOrders();
    }
  }

  canOpenOrderChat(order: Order): boolean {
    return ['confirmed', 'approved', 'processing', 'delivered'].includes(order.status);
  }

  async openOrderChat(order: Order, event?: Event): Promise<void> {
    event?.stopPropagation();
    if (!order?._id || !this.canOpenOrderChat(order)) return;
    const modal = await this.modalController.create({
      component: OrderChatComponent,
      componentProps: {
        orderId: order._id,
        dishName: order.dishName,
        trackingNumber: (order as any).trackingNumber || ''
      },
      cssClass: 'suga-order-chat-sheet',
      initialBreakpoint: 0.78,
      breakpoints: [0, 0.55, 0.78, 0.96],
      handle: false
    });
    await modal.present();
  }

  private async openPendingOrderFromState(): Promise<void> {
    if (!this.pendingOpenOrderId || this.openedStateOrder) return;
    const order = this.orders.find((item) => String(item?._id || '') === this.pendingOpenOrderId);
    if (!order) return;
    this.openedStateOrder = true;
    this.uiFeedback.success('Payment confirmed. Opening your active order status.');
    await this.viewOrderDetails(order);
  }

  trackByOrder(_index: number, order: Order): string {
    return order._id;
  }

  getOrderCardId(order: Order): string {
    return `dashboard-order-${order?._id || ''}`;
  }

  getOrderCardClasses(order: Order): Record<string, boolean> {
    return {
      'order-card-pending-chef': this.isPendingChefAcceptance(order),
      'order-card-chef-accepted': this.isChefAccepted(order) && order.status !== 'completed',
      'order-card-completed': order.status === 'completed',
      'order-card-focus': this.focusedOrderId === order._id
    };
  }

  isPendingChefAcceptance(order: Order): boolean {
    return order.status === 'placed';
  }

  isChefAccepted(order: Order): boolean {
    return ['confirmed', 'approved', 'processing', 'delivered', 'completed'].includes(order.status);
  }

  private focusOrderCard(orderId: string): void {
    this.selectedSegment = 'liveOrder';
    const order = this.orders.find((item) => item._id === orderId);
    if (order?.status === 'completed') {
      this.selectedSegment = 'completedOrders';
    }

    this.focusedOrderId = orderId;
    setTimeout(() => {
      const card = document.getElementById(`dashboard-order-${orderId}`);
      card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      window.setTimeout(() => {
        if (this.focusedOrderId === orderId) {
          this.focusedOrderId = '';
        }
      }, 2600);
    }, 120);
  }

  getOrderStatusLabel(order: Order): string {
    const chef = order.chefUsername ? `@${order.chefUsername}` : '@chef';
    const dispatchStatus = order.dispatchStatus || 'unassigned';

    if (order.status === 'placed') {
      return `Pending ${chef} approval`;
    }
    if (order.status === 'declined') {
      return `Declined by ${chef}`;
    }
    if (order.status === 'confirmed') {
      return `Accepted by ${chef}`;
    }
    if (order.status === 'processing') {
      if (dispatchStatus === 'assigned') return 'Sent for delivery';
      if (dispatchStatus === 'picked_up' || dispatchStatus === 'in_transit') return 'Out for delivery';
      return 'Processing';
    }
    if (order.status === 'delivered') {
      return dispatchStatus === 'delivered_to_customer' ? 'Delivered' : 'Sent for delivery';
    }
    if (order.status === 'completed') {
      return 'Completed';
    }
    if (order.status === 'cancelled') {
      return 'Cancelled by system';
    }
    return order.status || 'Pending';
  }

  private sortNewestFirst(orders: Order[]): Order[] {
    return [...orders].sort((a, b) => {
      const aTime = new Date(a.orderTime || 0).getTime();
      const bTime = new Date(b.orderTime || 0).getTime();
      return bTime - aTime;
    });
  }

  isArray(value: any): boolean {
    return Array.isArray(value);
  }

  timeAgo(dateInput: Date | string | undefined): string {
    if (!dateInput) {
      return 'Unknown time';
    }
  
    const now = new Date();
    let orderTime: Date;
  
    // Handle if input is already a Date object
    if (dateInput instanceof Date) {
      orderTime = dateInput;
    } else {
      // Convert string to Date
      orderTime = new Date(dateInput);
    }
  
    const diffInSeconds = Math.floor((now.getTime() - orderTime.getTime()) / 1000);
  
    if (diffInSeconds < 60) {
      return `${diffInSeconds} seconds ago`;
    } else if (diffInSeconds < 3600) {
      return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    } else if (diffInSeconds < 86400) {
      return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    } else {
      return `${Math.floor(diffInSeconds / 86400)} days ago`;
    }
  }
  
  
}
