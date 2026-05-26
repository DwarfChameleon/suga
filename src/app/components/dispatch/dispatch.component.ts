import { Component, OnInit, OnDestroy } from '@angular/core';
import { DispatchService } from 'src/app/services/dispatch.service';
import { UiFeedbackService } from 'src/app/services/ui-feedback.service';
import { Router } from '@angular/router';
import { TokenStorageService } from 'src/app/services/token-storage.service';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ModalController } from '@ionic/angular';
import { OrderInfoComponent } from '../order-info/order-info.component';
import { OrderRatingComponent } from '../order-rating/order-rating.component';
import { NotificationSocketService } from 'src/app/services/notification-socket.service';
import { Subscription } from 'rxjs';
import { humanizeHistoryLabel } from 'src/app/utils/history-formatters';

type DispatchSectionKey = 'orders' | 'profile' | 'analytics' | 'history' | 'payout';

@Component({
  selector: 'app-dispatch',
  templateUrl: './dispatch.component.html',
  styleUrls: ['./dispatch.component.scss']
})
export class DispatchComponent implements OnInit, OnDestroy {
  stats = {
    activeCount: 0,
    completedCount: 0,
    availableCount: 0,
    isAvailable: true
  };
  profile: any = null;
  activeOrders: any[] = [];
  availableOrders: any[] = [];
  completedOrders: any[] = [];
  walletBalance = 0;
  walletCurrency = 'NGN';
  walletTransactions: any[] = [];
  analytics: any = null;
  historyOrders: any[] = [];
  selectedTab: 'active' | 'available' | 'completed' = 'active';
  mapUrl: SafeResourceUrl | null = null;
  isTracking = false;
  locationError = '';
  private watchId: number | null = null;
  private promptedRatingIds = new Set<string>();
  private ratingsInitialized = false;
  private completedSeen = new Set<string>();
  private notificationSub?: Subscription;
  private seenNotificationIds = new Set<string>();
  private liveRefreshTimer?: ReturnType<typeof setInterval>;
  sections = {
    orders: true,
    profile: true,
    analytics: true,
    history: true,
    payout: true
  };
  loading = true;

  constructor(
    private readonly dispatchService: DispatchService,
    private readonly uiFeedback: UiFeedbackService,
    private readonly router: Router,
    private readonly tokenStorage: TokenStorageService,
    private readonly sanitizer: DomSanitizer,
    private readonly modalController: ModalController,
    private readonly notificationSocket: NotificationSocketService
  ) {}

  ngOnInit(): void {
    this.loadAll();
    this.refreshMap();
    this.liveRefreshTimer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        this.loadAvailableOrders();
      }
    }, 20000);
    this.notificationSub = this.notificationSocket.notifications$.subscribe((notification: any) => {
      const type = String(notification?.type || '');
      const orderId = String(notification?.data?.orderId || '');
      const notificationKey = String(notification?._id || `${type}_${orderId}`);
      if (!orderId || this.seenNotificationIds.has(notificationKey)) {
        return;
      }
      if (!type.startsWith('dispatch:') && !type.startsWith('order:dispatch_payout') && type !== 'order:new') {
        return;
      }

      this.seenNotificationIds.add(notificationKey);
      if ([
        'dispatch:assigned',
        'dispatch:delivery_code_ready',
        'dispatch:status',
        'dispatch:delivered',
        'order:new',
        'order:status',
        'order:dispatch_payout_released',
        'order:dispatch_payout_auto_released'
      ].includes(type)) {
        this.loadAll();
      }
    });
  }

  ngOnDestroy(): void {
    if (this.watchId !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(this.watchId);
    }
    this.notificationSub?.unsubscribe();
    if (this.liveRefreshTimer) {
      clearInterval(this.liveRefreshTimer);
    }
  }

  loadAll(): void {
    this.loading = true;
    this.dispatchService.getDashboard().subscribe({
      next: (res) => {
        this.stats = { ...this.stats, ...(res?.stats || {}) };
        this.activeOrders = Array.isArray(res?.activeOrders) ? res.activeOrders : [];
        this.promptRatingIfNeeded(this.activeOrders);
        this.loadAvailableOrders();
      },
      error: (error) => {
        this.loading = false;
        this.uiFeedback.error(error?.error?.message || 'Failed to load dispatch dashboard.');
      }
    });

    this.dispatchService.getProfile().subscribe({
      next: (res) => {
        this.profile = res;
      },
      error: () => {}
    });

    this.dispatchService.getWalletSummary().subscribe({
      next: (res) => {
        this.walletBalance = Number(res?.wallet?.balance || 0);
        this.walletCurrency = res?.wallet?.currency || 'NGN';
        this.walletTransactions = Array.isArray(res?.transactions) ? res.transactions : [];
      },
      error: () => {}
    });

    this.dispatchService.getAnalytics().subscribe({
      next: (res) => {
        this.analytics = res;
      },
      error: () => {}
    });

    this.dispatchService.getHistory().subscribe({
      next: (res) => {
        this.historyOrders = Array.isArray(res?.orders) ? res.orders : [];
      },
      error: () => {}
    });
  }

  loadAvailableOrders(): void {
    this.dispatchService.getAvailableOrders().subscribe({
      next: (res) => {
        this.availableOrders = Array.isArray(res?.orders) ? res.orders : [];
        this.loading = false;
      },
      error: (error) => {
        this.loading = false;
        this.uiFeedback.error(error?.error?.message || 'Failed to load available orders.');
      }
    });
  }

  loadCompletedOrders(): void {
    this.dispatchService.getOrdersByStatus('completed').subscribe({
      next: (res) => {
        this.completedOrders = Array.isArray(res?.orders) ? res.orders : [];
        this.promptRatingIfNeeded(this.completedOrders);
      },
      error: () => {}
    });
  }

  selectTab(tab: 'active' | 'available' | 'completed'): void {
    this.selectedTab = tab;
    if (tab === 'available') {
      this.loadAvailableOrders();
    } else if (tab === 'completed') {
      this.loadCompletedOrders();
    }
  }

  toggleAvailability(): void {
    const next = !this.stats.isAvailable;
    this.dispatchService.updateProfile({ isAvailable: next }).subscribe({
      next: () => {
        this.stats.isAvailable = next;
        this.profile = {
          ...(this.profile || {}),
          dispatchProfile: {
            ...(this.profile?.dispatchProfile || {}),
            isAvailable: next
          }
        };
        this.uiFeedback.success(next ? 'You are now available for deliveries.' : 'Availability turned off.');
      },
      error: (error) => {
        this.uiFeedback.error(error?.error?.message || 'Could not update availability.');
      }
    });
  }

  async startLocationTracking(): Promise<void> {
    if (!navigator.geolocation) {
      this.locationError = 'Geolocation not supported on this device.';
      return;
    }
    this.isTracking = true;
    this.locationError = '';

    this.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        this.dispatchService.updateLocation(lat, lng).subscribe({
          next: () => {},
          error: () => {}
        });
        this.setMapUrl(lat, lng);
      },
      (err) => {
        this.locationError = err.message || 'Unable to read location.';
        this.isTracking = false;
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );
  }

  stopLocationTracking(): void {
    if (this.watchId !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(this.watchId);
    }
    this.watchId = null;
    this.isTracking = false;
  }

  refreshMap(): void {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.setMapUrl(pos.coords.latitude, pos.coords.longitude);
      },
      () => {}
    );
  }

  private setMapUrl(lat: number, lng: number): void {
    const url = `https://maps.google.com/maps?q=${lat},${lng}&z=15&output=embed`;
    this.mapUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  acceptOrder(orderId: string): void {
    if (!orderId) return;
    this.dispatchService.acceptOrder(orderId).subscribe({
      next: () => {
        this.uiFeedback.success('Order accepted.');
        this.loadAll();
      },
      error: (error) => {
        this.uiFeedback.error(error?.error?.message || 'Could not accept order.');
      }
    });
  }

  declineOrder(orderId: string): void {
    if (!orderId) return;
    this.dispatchService.declineOrder(orderId).subscribe({
      next: () => {
        this.uiFeedback.success('Delivery request declined.');
        this.loadAll();
      },
      error: (error) => {
        this.uiFeedback.error(error?.error?.message || 'Could not decline this request.');
      }
    });
  }

  updateStatus(orderId: string, status: 'picked_up' | 'in_transit' | 'delivered_to_customer' | 'failed'): void {
    if (!orderId) return;
    if (status === 'delivered_to_customer') {
      this.openOrderDetails(orderId, true);
      return;
    }

    this.dispatchService.updateOrderStatus(orderId, status).subscribe({
      next: () => {
        this.uiFeedback.success(`Order marked ${status.replace('_', ' ')}.`);
        this.loadAll();
      },
      error: (error) => {
        this.uiFeedback.error(error?.error?.message || 'Status update failed.');
      }
    });
  }

  openRewards(): void {
    this.router.navigate(['/components/rewards']);
  }

  openStoryPage(): void {
    this.router.navigate(['/components/story']);
  }

  goHome(): void {
    this.router.navigate(['/components/explore']);
  }

  openWallet(): void {
    this.router.navigate(['/components/wallet']);
  }

  openNotifications(): void {
    this.router.navigate(['/components/notifications']);
  }

  openProfileSettings(): void {
    this.router.navigate(['/components/dispatch-profile']);
  }

  logout(): void {
    this.tokenStorage.signOut();
    this.router.navigate(['/login']);
  }

  async openOrderDetails(orderId: string, openScanner = false): Promise<void> {
    const modal = await this.modalController.create({
      component: OrderInfoComponent,
      componentProps: { orderId, openScanner },
      breakpoints: [0, 1],
      initialBreakpoint: 1,
      handle: false,
      cssClass: 'suga-order-fullsheet'
    });
    await modal.present();
    const { data } = await modal.onDidDismiss();
    if (data?.changed) {
      this.loadAll();
    }
  }

  toggleSection(section: DispatchSectionKey): void {
    this.sections[section] = !this.sections[section];
  }

  displayWalletTxLabel(type?: string): string {
    return humanizeHistoryLabel(type);
  }

  async openHistoryOrder(tx: any): Promise<void> {
    if (!tx?.orderId) return;
    await this.openOrderDetails(tx.orderId);
  }

  getDispatchHeadline(order: any): string {
    const dispatchStatus = String(order?.dispatchStatus || 'unassigned');
    if (dispatchStatus === 'assigned' && !order?.dispatchAcceptedAt) return 'Waiting for your response';
    if (dispatchStatus === 'assigned') return 'Accepted, ready for pickup';
    if (dispatchStatus === 'picked_up') return 'Picked up from chef';
    if (dispatchStatus === 'in_transit') return 'On the way to customer';
    if (dispatchStatus === 'delivered_to_customer' || order?.status === 'delivered') return 'Waiting for customer confirmation';
    if (dispatchStatus === 'failed') return 'Delivery issue reported';
    return 'Open delivery request';
  }

  getDispatchStatusTone(order: any): 'pending' | 'active' | 'success' | 'danger' {
    const dispatchStatus = String(order?.dispatchStatus || 'unassigned');
    if (dispatchStatus === 'assigned' && !order?.dispatchAcceptedAt) return 'pending';
    if (dispatchStatus === 'failed') return 'danger';
    if (dispatchStatus === 'delivered_to_customer' || order?.status === 'delivered' || order?.status === 'completed') return 'success';
    return 'active';
  }

  canAccept(order: any): boolean {
    const dispatchStatus = String(order?.dispatchStatus || 'unassigned');
    return dispatchStatus === 'assigned' || dispatchStatus === 'unassigned';
  }

  canDecline(order: any): boolean {
    return String(order?.dispatchStatus || '') === 'assigned' && !order?.dispatchAcceptedAt;
  }

  canMarkPickedUp(order: any): boolean {
    return String(order?.dispatchStatus || '') === 'assigned' && !!order?.dispatchAcceptedAt;
  }

  canMarkInTransit(order: any): boolean {
    return String(order?.dispatchStatus || '') === 'picked_up';
  }

  canMarkDelivered(order: any): boolean {
    return String(order?.dispatchStatus || '') === 'in_transit';
  }

  canMarkFailed(order: any): boolean {
    return ['assigned', 'picked_up', 'in_transit'].includes(String(order?.dispatchStatus || ''));
  }

  canShareLocation(order: any): boolean {
    return ['assigned', 'picked_up', 'in_transit'].includes(String(order?.dispatchStatus || ''));
  }

  private async promptRatingIfNeeded(orders: any[]): Promise<void> {
    const completedOrders = orders.filter((order) => order?.status === 'completed');
    if (!this.ratingsInitialized) {
      completedOrders.forEach((o) => o?._id && this.completedSeen.add(o._id));
      this.ratingsInitialized = true;
      return;
    }

    const newlyCompleted = completedOrders.find(
      (order) => !!order?._id && !this.completedSeen.has(order._id) && !this.hasRated(order)
    );
    if (!newlyCompleted || !newlyCompleted._id || this.promptedRatingIds.has(newlyCompleted._id)) return;
    this.completedSeen.add(newlyCompleted._id);
    this.promptedRatingIds.add(newlyCompleted._id);

    const modal = await this.modalController.create({
      component: OrderRatingComponent,
      componentProps: { orderId: newlyCompleted._id, dishName: newlyCompleted.dishName }
    });
    await modal.present();
    await modal.onDidDismiss();
  }

  private hasRated(order: any): boolean {
    const ratings = Array.isArray(order?.ratings) ? order.ratings : [];
    return ratings.some((r: any) => r.role === 'dispatch');
  }
}
