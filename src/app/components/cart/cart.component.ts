import { Component, OnDestroy, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { CartItem, CartService } from 'src/app/services/cart.service';
import { LoadingService } from 'src/app/services/loading.service';
import { BulkOrderResponse, OrderService } from 'src/app/services/order.service';
import { UiFeedbackService } from 'src/app/services/ui-feedback.service';
import { PaymentModalComponent } from '../payment-modal/payment-modal.component';
import { PaymentSuccessSheetComponent } from '../payment-success-sheet/payment-success-sheet.component';
import { Subscription } from 'rxjs';
import { TokenStorageService } from 'src/app/services/token-storage.service';
import { LoginModalComponent } from 'src/app/login-modal/login-modal.component';

@Component({
  selector: 'app-cart',
  templateUrl: './cart.component.html',
  styleUrls: ['./cart.component.scss']
})
export class CartComponent implements OnInit, OnDestroy {
  items: CartItem[] = [];
  subtotal = 0;
  feeAmount = 0;
  totalAmount = 0;
  isSubmitting = false;
  isLoggedIn = false;
  private cartSub?: Subscription;
  private authSub?: Subscription;

  constructor(
    private readonly cartService: CartService,
    private readonly orderService: OrderService,
    private readonly modalCtrl: ModalController,
    private readonly loadingService: LoadingService,
    private readonly uiFeedback: UiFeedbackService,
    private readonly router: Router,
    private readonly location: Location,
    private readonly tokenStorage: TokenStorageService
  ) {}

  ngOnInit(): void {
    this.refreshAuthState();
    this.refresh();
    this.cartSub = this.cartService.cart$.subscribe(() => this.refresh());
    this.authSub = this.tokenStorage.authState$.subscribe(() => this.refreshAuthState());
  }

  ngOnDestroy(): void {
    this.cartSub?.unsubscribe();
    this.authSub?.unsubscribe();
  }

  increase(item: CartItem): void {
    this.cartService.addItem({
      food_id: item.food_id,
      dishName: item.dishName,
      price: item.price,
      priceCurrency: item.priceCurrency,
      preparationTime: item.preparationTime,
      chefId: item.chefId,
      chefUsername: item.chefUsername,
      image: item.image,
      category: item.category
    }, 1);
  }

  decrease(item: CartItem): void {
    if (item.quantity <= 1) {
      this.remove(item);
      return;
    }
    this.cartService.updateQuantity(item.food_id, item.quantity - 1);
  }

  remove(item: CartItem): void {
    this.cartService.removeItem(item.food_id);
    this.uiFeedback.success(`${item.dishName} removed from cart.`);
  }

  clearCart(): void {
    this.cartService.clear();
    this.uiFeedback.success('Cart cleared.');
  }

  async goBack(): Promise<void> {
    const top = await this.modalCtrl.getTop();
    if (top) {
      await this.modalCtrl.dismiss();
      return;
    }
    this.location.back();
  }

  async browseDishes(): Promise<void> {
    try {
      const top = await this.modalCtrl.getTop();
      if (top) await this.modalCtrl.dismiss();
    } catch {}
    await this.router.navigateByUrl('/components/explore', { replaceUrl: true });
    setTimeout(() => window.location.reload(), 80);
  }

  async checkout(): Promise<void> {
    if (!this.items.length) {
      this.uiFeedback.error('Your cart is empty.');
      return;
    }

    if (!this.isLoggedIn) {
      await this.openLoginModal();
      return;
    }

    this.isSubmitting = true;
    await this.loadingService.show('Preparing checkout...');
    const coords = await this.getCurrentLocation();
    const locationPayload = coords ? { deliveryLat: coords.lat, deliveryLng: coords.lng } : {};
    this.orderService.createBulkOrdersWithLocation(this.items, locationPayload).subscribe({
      next: async (result: BulkOrderResponse) => {
        await this.loadingService.hide();
        this.isSubmitting = false;

        const modal = await this.modalCtrl.create({
          component: PaymentModalComponent,
          componentProps: {
            orderId: result?.orderIds?.[0],
            orderIds: result?.orderIds || [],
            summaryLabel: `${result?.itemCount || this.items.length} item(s)`,
            price: result?.subtotal,
            feeAmount: result?.feeAmount,
            deliveryFee: result?.deliveryFee,
            totalAmount: result?.totalAmount
          }
        });

        await modal.present();
        const payment = await modal.onDidDismiss<{ paid?: boolean; orderId?: string; orderIds?: string[]; paymentProvider?: string }>();
        if (payment?.data?.paid) {
          this.cartService.clear();
          this.uiFeedback.success('Order payment confirmed.');
          await this.openPaymentSuccessSheet(
            payment.data.orderId || payment.data.orderIds?.[0] || result?.orderIds?.[0],
            payment.data.orderIds || result?.orderIds || [],
            payment.data.paymentProvider || ''
          );
        }
      },
      error: async () => {
        await this.loadingService.hide();
        this.isSubmitting = false;
        this.uiFeedback.error('Failed to checkout cart.');
      }
    });
  }

  private getCurrentLocation(): Promise<{ lat: number; lng: number } | null> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
      );
    });
  }

  private refresh(): void {
    this.items = this.cartService.getItems();
    this.subtotal = this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    this.feeAmount = Math.round(this.subtotal * 0.1);
    this.totalAmount = this.subtotal + this.feeAmount;
  }

  private refreshAuthState(): void {
    this.isLoggedIn = !!this.tokenStorage.getAccessToken();
  }

  get checkoutLabel(): string {
    return this.isLoggedIn ? 'Checkout' : 'Login to checkout';
  }

  private async openLoginModal(): Promise<void> {
    this.uiFeedback.error('Please log in before checkout.');
    const modal = await this.modalCtrl.create({
      component: LoginModalComponent,
      componentProps: { returnUrl: '/components/cart' },
      cssClass: 'login-modal-class',
      handle: true,
      initialBreakpoint: 1,
      breakpoints: [0, 0.92, 1],
      backdropDismiss: false
    });
    await modal.present();
  }

  private async openPaymentSuccessSheet(orderId: string, orderIds: string[] = [], paymentProvider = ''): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: PaymentSuccessSheetComponent,
      componentProps: { orderId, orderIds, paymentProvider, dashboardRole: 'consumer' },
      cssClass: 'suga-payment-success-sheet',
      handle: true,
      initialBreakpoint: 0.58,
      breakpoints: [0, 0.42, 0.58, 0.9]
    });
    await modal.present();
  }
}
