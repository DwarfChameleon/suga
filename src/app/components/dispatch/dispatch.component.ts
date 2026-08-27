import { Component, OnInit, OnDestroy } from '@angular/core';
import { DispatchService } from 'src/app/services/dispatch.service';
import { UiFeedbackService } from 'src/app/services/ui-feedback.service';
import { ActivatedRoute, Router } from '@angular/router';
import { TokenStorageService } from 'src/app/services/token-storage.service';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ModalController } from '@ionic/angular';
import { OrderInfoComponent } from '../order-info/order-info.component';
import { OrderRatingComponent } from '../order-rating/order-rating.component';
import { OrderChatComponent } from '../order-chat/order-chat.component';
import { NotificationSocketService } from 'src/app/services/notification-socket.service';
import { Subscription } from 'rxjs';
import { humanizeHistoryLabel } from 'src/app/utils/history-formatters';
import { resolveUploadUrl } from 'src/app/utils/media-url';

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
  showAllRoutes = false;
  showAllPayouts = false;

  constructor(
    private readonly dispatchService: DispatchService,
    private readonly uiFeedback: UiFeedbackService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly tokenStorage: TokenStorageService,
    private readonly sanitizer: DomSanitizer,
    private readonly modalController: ModalController,
    private readonly notificationSocket: NotificationSocketService
  ) {}

  ngOnInit(): void {
    const requestedTab = String(this.route.snapshot.queryParamMap.get('tab') || '');
    if (['active', 'available', 'completed'].includes(requestedTab)) {
      this.selectedTab = requestedTab as 'active' | 'available' | 'completed';
    }
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

  openStory(): void {
    this.openStoryPage();
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

  editProfile(): void {
    this.openProfileSettings();
  }

  finishProfile(): void {
    this.openProfileSettings();
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

  get currentOrders(): any[] {
    if (this.selectedTab === 'available') return this.availableOrders;
    if (this.selectedTab === 'completed') return this.completedOrders;
    return this.activeOrders;
  }

  get displayedRoutes(): any[] {
    return this.showAllRoutes ? this.historyOrders : this.historyOrders.slice(0, 4);
  }

  get displayedPayouts(): any[] {
    return this.showAllPayouts ? this.walletTransactions : this.walletTransactions.slice(0, 3);
  }

  get hasDispatchNotifications(): boolean {
    return this.seenNotificationIds.size > 0;
  }

  get profileCompleteness(): number {
    const fields = this.getProfileCompletionFields();
    if (!fields.length) return 0;
    const completed = fields.filter((field) => field.done).length;
    return Math.round((completed / fields.length) * 100);
  }

  get missingFields(): Array<{ label: string; icon: string }> {
    return this.getProfileCompletionFields()
      .filter((field) => !field.done)
      .map(({ label, icon }) => ({ label, icon }));
  }

  toggleAllRoutes(): void {
    this.showAllRoutes = !this.showAllRoutes;
  }

  toggleAllPayouts(): void {
    this.showAllPayouts = !this.showAllPayouts;
  }

  setOrderTab(tab: 'active' | 'available' | 'completed'): void {
    this.selectTab(tab);
  }

  async openOrder(order: any): Promise<void> {
    await this.openOrderDetails(order?._id || order?.id);
  }

  canOpenOrderChat(order: any): boolean {
    return !!(order?._id || order?.id) &&
      this.selectedTab !== 'available' &&
      ['confirmed', 'approved', 'processing', 'delivered'].includes(String(order?.status || ''));
  }

  async openOrderChat(order: any, event?: Event): Promise<void> {
    event?.stopPropagation();
    if (!this.canOpenOrderChat(order)) return;
    const modal = await this.modalController.create({
      component: OrderChatComponent,
      componentProps: {
        orderId: order._id || order.id,
        dishName: order.dishName || 'Delivery order',
        trackingNumber: order.trackingNumber || ''
      },
      cssClass: 'suga-order-chat-sheet',
      initialBreakpoint: 0.78,
      breakpoints: [0, 0.55, 0.78, 0.96],
      handle: false
    });
    await modal.present();
  }

  async openRoute(route: any): Promise<void> {
    await this.openOrderDetails(route?._id || route?.orderId || route?.id);
  }

  getDispatchName(): string {
    return this.profile?.dispatchProfile?.companyName || this.profile?.username || 'Dispatch rider';
  }

  getDispatchPhoto(): string {
    const storedUser = this.tokenStorage.getUser();
    return resolveUploadUrl(
      this.profile?.profilePicture
        || this.profile?.avatar
        || this.profile?.dispatchProfile?.photo
        || storedUser?.profilePicture
        || storedUser?.avatar,
      'assets/images/users/default-rider.jpg'
    );
  }

  getVehicleType(): string {
    const types = this.profile?.dispatchProfile?.vehicleTypes;
    if (Array.isArray(types) && types.length) return types.join(', ');
    return this.profile?.dispatchProfile?.vehicleType || this.profile?.dispatchProfile?.vehicle || 'Vehicle profile not completed yet.';
  }

  getVerificationStatus(): string {
    return this.profile?.dispatchProfile?.verificationStatus || 'pending';
  }

  getPlateNumber(): string {
    return this.profile?.dispatchProfile?.plateNumber || this.profile?.dispatchProfile?.vehiclePlateNumber || 'Not added';
  }

  getPhoneNumber(): string {
    return this.profile?.phoneNumber || this.profile?.phone || 'Not added';
  }

  getCustomerUsername(order: any): string {
    return order?.customerUsername || order?.username || order?.consumerUsername || 'customer';
  }

  getOrderStatusLabel(order: any): string {
    return this.getDispatchHeadline(order);
  }

  getOrderFee(order: any): number {
    return Number(order?.deliveryFee ?? order?.dispatchFee ?? order?.price ?? 0);
  }

  getEmptyOrderTitle(): string {
    if (this.selectedTab === 'available') return 'No open jobs';
    if (this.selectedTab === 'completed') return 'No completed deliveries';
    return 'No active deliveries';
  }

  getEmptyOrderText(): string {
    if (this.selectedTab === 'available') return 'New delivery requests will appear here.';
    if (this.selectedTab === 'completed') return 'Completed routes will appear here.';
    return 'Accepted deliveries will appear here.';
  }

  private getProfileCompletionFields(): Array<{ label: string; icon: string; done: boolean }> {
    const dispatchProfile = this.profile?.dispatchProfile || {};
    return [
      { label: 'Email', icon: 'mail-outline', done: !!this.profile?.email },
      { label: 'Phone', icon: 'call-outline', done: !!(this.profile?.phoneNumber || this.profile?.phone) },
      { label: 'Country', icon: 'globe-outline', done: !!(this.profile?.country || dispatchProfile.country) },
      { label: 'State/Region', icon: 'location-outline', done: !!(this.profile?.state || this.profile?.region || dispatchProfile.state || dispatchProfile.region) },
      { label: 'Profile Photo', icon: 'camera-outline', done: !!(this.profile?.profilePicture || this.profile?.avatar) },
      { label: 'Vehicle', icon: 'bicycle-outline', done: !!(dispatchProfile.vehicleType || dispatchProfile.vehicle || dispatchProfile.vehicleTypes?.length) },
      { label: 'ID Verification', icon: 'card-outline', done: ['approved', 'verified'].includes(String(dispatchProfile.verificationStatus || '').toLowerCase()) },
      { label: 'Payout Account', icon: 'wallet-outline', done: !!(dispatchProfile.bankName || dispatchProfile.bankAccountNumber || dispatchProfile.payoutAccount) }
    ];
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
