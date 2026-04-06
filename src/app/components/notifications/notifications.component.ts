import { Component, OnInit } from '@angular/core';
import { NotificationService } from 'src/app/services/notification.service';
import { AppNotification } from 'src/app/interface/notification';
import { TokenStorageService } from 'src/app/services/token-storage.service';
import { NetworkService } from 'src/app/services/network.service';
import { ModalController } from '@ionic/angular';
import { OrderInfoComponent } from '../order-info/order-info.component';

@Component({
  selector: 'app-notifications',
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.scss']
})
export class NotificationsComponent implements OnInit {
  notifications: AppNotification[] = [];
  filtered: AppNotification[] = [];
  activeFilter: 'system' | 'my' = 'my';
  selectedNotification?: AppNotification;
  isLoading = true;
  isOnline = true;

  constructor(
    private notificationService: NotificationService,
    private tokenStorage: TokenStorageService,
    private networkService: NetworkService,
    private modalController: ModalController
  ) {}

  ngOnInit(): void {
    this.notificationService.getNotifications().subscribe(items => {
      this.notifications = items;
      this.applyFilter();
      this.isLoading = false;
    });
    this.notificationService.loadInitial();
    this.networkService.online$.subscribe((online) => {
      this.isOnline = online;
    });
  }

  markAllRead(): void {
    this.notificationService.markAllRead().subscribe(() => {
      this.notificationService.updateAllReadState();
    });
  }

  markRead(notification: AppNotification): void {
    if (notification.read) return;
    this.notificationService.markRead([notification._id]).subscribe(() => {
      this.notificationService.updateReadState([notification._id]);
    });
  }

  setFilter(filter: 'system' | 'my'): void {
    this.activeFilter = filter;
    this.applyFilter();
  }

  private applyFilter(): void {
    if (this.activeFilter === 'system') {
      this.filtered = this.notifications.filter(n => !n.recipientRole);
      return;
    }
    this.filtered = this.notifications.filter(n => !!n.recipientRole);
  }

  openNotification(notification: AppNotification): void {
    this.selectedNotification = notification;
    this.markRead(notification);
  }

  closeNotification(): void {
    this.selectedNotification = undefined;
  }

  canOpenOrder(notification?: AppNotification): boolean {
    return !!notification?.data?.orderId;
  }

  async openOrder(notification?: AppNotification): Promise<void> {
    const orderId = String(notification?.data?.orderId || '').trim();
    if (!orderId) return;
    const modal = await this.modalController.create({
      component: OrderInfoComponent,
      componentProps: { orderId },
      breakpoints: [0, 1],
      initialBreakpoint: 1,
      handle: false,
      cssClass: 'suga-order-fullsheet'
    });
    await modal.present();
  }

  trackById(_index: number, item: AppNotification): string {
    return item._id;
  }
}
