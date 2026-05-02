import { Component, Input, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { BulkOrderResponse, OrderService } from '../../services/order.service';
import { UserDetails } from '../../interface/user-details';
import { AuthService } from '../../services/authservice.service';
import { LoginModalComponent } from '../../login-modal/login-modal.component';
import { UiFeedbackService } from '../../services/ui-feedback.service';
import { LoadingService } from '../../services/loading.service';
import { PaymentModalComponent } from '../payment-modal/payment-modal.component';
import { CartService } from 'src/app/services/cart.service';
import { Router } from '@angular/router';
import { GiftRecipientSuggestion, UserService } from 'src/app/services/user.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-order-modal',
  templateUrl: './order-modal.component.html',
  styleUrls: ['./order-modal.component.scss']
})
export class OrderModalComponent implements OnInit {

  @Input() dishName?: string;
  @Input() price?: number;
  @Input() preparationTime?: string;
  @Input() chefName?: string;
  @Input() user?: UserDetails;
  @Input() food_id?: string;
  @Input() chefID?: string;
  @Input() image?: string;
  @Input() category?: string;

  isLoggedIn = false;
  successMessage: string | null = null;
  errorMessage: string | null = null;
  isSubmitting = false;
  cartCount = 0;
  cartSubtotal = 0;
  isGift = false;
  recipientUsername = '';
  recipientPhoneNumber = '';
  giftSuggestions: GiftRecipientSuggestion[] = [];
  isLoadingGiftSuggestions = false;
  private chefCoords: { lat: number; lng: number } | null = null;

  constructor(
    private modalCtrl: ModalController,
    private orderService: OrderService,
    private auth: AuthService,
    private uiFeedback: UiFeedbackService,
    private loadingService: LoadingService,
    private cartService: CartService,
    private router: Router,
    private userService: UserService
  ) {}

  ngOnInit(): void {
    this.isLoggedIn = this.auth.isLoggedIn();
    this.refreshCartState();
    this.cartService.cart$.subscribe(() => this.refreshCartState());
    this.loadChefCoords();
    if (this.isLoggedIn) {
      void this.loadGiftSuggestions();
    }
  }

  onGiftToggleChange(enabled: boolean): void {
    this.isGift = enabled;
    if (enabled) {
      void this.loadGiftSuggestions();
      return;
    }
    this.recipientUsername = '';
    this.recipientPhoneNumber = '';
  }

  selectGiftSuggestion(suggestion: GiftRecipientSuggestion): void {
    if (!suggestion?.username) return;
    this.recipientUsername = suggestion.username;
    this.recipientPhoneNumber = suggestion.phoneNumber || '';
  }

  giftSuggestionLabel(suggestion: GiftRecipientSuggestion): string {
    const parts: string[] = [];
    if (suggestion?.relationship) parts.push(String(suggestion.relationship));
    if (suggestion?.phoneNumber) parts.push(suggestion.phoneNumber);
    if (suggestion?.city) parts.push(suggestion.city);
    if (suggestion?.country) parts.push(suggestion.country);
    return parts.filter(Boolean).join(' · ') || 'Suggested';
  }

  private async loadGiftSuggestions(): Promise<void> {
    if (!this.isLoggedIn) return;
    this.isLoadingGiftSuggestions = true;
    try {
      const res = await firstValueFrom(this.userService.getGiftRecipientSuggestions(8));
      this.giftSuggestions = Array.isArray(res?.recipients) ? res.recipients : [];
    } catch {
      this.giftSuggestions = [];
    } finally {
      this.isLoadingGiftSuggestions = false;
    }
  }

  async placeOrder(): Promise<void> {
    if (!this.isLoggedIn) {
      await this.openLoginModal();
      return;
    }

    if (!this.chefID || !this.chefName) {
      this.errorMessage = 'Chef information is missing.';
      return;
    }

    if (this.isGift && !this.recipientPhoneNumber.trim()) {
      this.uiFeedback.error('Recipient phone number is required for gifts.');
      return;
    }

    const payload: any = {
      dishName: this.dishName,
      price: this.price,
      preparationTime: this.preparationTime,
      chefId: this.chefID,
      chefUsername: this.chefName,
      food_id: this.food_id
    };

    if (!this.isGift) {
      const coords = await this.getCurrentLocation();
      if (coords) {
        payload.deliveryLat = coords.lat;
        payload.deliveryLng = coords.lng;
      }
    }
    if (this.chefCoords) {
      payload.chefLat = this.chefCoords.lat;
      payload.chefLng = this.chefCoords.lng;
    }

    this.isSubmitting = true;
    await this.loadingService.show('Placing order...');

    const orderRequest = this.isGift
      ? this.orderService.createGiftOrder({
          ...payload,
          recipientUsername: this.recipientUsername.trim(),
          recipientPhoneNumber: this.recipientPhoneNumber.trim()
        })
      : this.orderService.createOrder(payload);

    orderRequest.subscribe({
      next: async (order: any) => {
        this.successMessage = null;
        this.errorMessage = null;
        this.isSubmitting = false;
        this.loadingService.hide();
        const modal = await this.modalCtrl.create({
          component: PaymentModalComponent,
          componentProps: {
            orderId: order?._id,
            dishName: order?.dishName || this.dishName,
            price: order?.price || this.price,
            feeAmount: order?.feeAmount,
            deliveryFee: order?.deliveryFee,
            totalAmount: order?.totalAmount
          }
        });
        await modal.present();
        const result = await modal.onDidDismiss<{ paid?: boolean }>();
        if (result?.data?.paid) {
          this.uiFeedback.success('Order payment confirmed.');
          await this.modalCtrl.dismiss();
        }
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'Failed to place order. Please try again.';
        this.uiFeedback.error(this.errorMessage || 'Failed to place order. Please try again.');
        this.successMessage = null;
        this.isSubmitting = false;
        this.loadingService.hide();
      }
    });
  }

  addCurrentItemToCart(): void {
    if (!this.food_id || !this.chefID || !this.chefName || !this.dishName || !this.price || !this.preparationTime) {
      this.uiFeedback.error('Food details are incomplete.');
      return;
    }
    this.cartService.addItem({
      food_id: this.food_id,
      dishName: this.dishName,
      price: this.price,
      preparationTime: this.preparationTime,
      chefId: this.chefID,
      chefUsername: this.chefName,
      image: this.image,
      category: this.category
    });
    this.uiFeedback.success('Added to cart.');
  }

  async checkoutCart(): Promise<void> {
    if (!this.isLoggedIn) {
      await this.openLoginModal();
      return;
    }

    const cartItems = this.cartService.getItems();
    if (!cartItems.length) {
      this.uiFeedback.error('Your cart is empty.');
      return;
    }

    this.isSubmitting = true;
    await this.loadingService.show('Preparing cart order...');
    const coords = await this.getCurrentLocation();
    const locationPayload: any = coords ? { deliveryLat: coords.lat, deliveryLng: coords.lng } : {};
    if (this.chefCoords) {
      locationPayload.chefLat = this.chefCoords.lat;
      locationPayload.chefLng = this.chefCoords.lng;
    }
    this.orderService.createBulkOrdersWithLocation(cartItems, locationPayload).subscribe({
      next: async (result: BulkOrderResponse) => {
        await this.loadingService.hide();
        this.isSubmitting = false;
        const modal = await this.modalCtrl.create({
          component: PaymentModalComponent,
          componentProps: {
            orderId: result?.orderIds?.[0],
            orderIds: result?.orderIds || [],
            summaryLabel: `${result?.itemCount || cartItems.length} item(s)`,
            dishName: this.dishName,
            price: result?.subtotal,
            feeAmount: result?.feeAmount,
            deliveryFee: result?.deliveryFee,
            totalAmount: result?.totalAmount
          }
        });
        await modal.present();
        const payment = await modal.onDidDismiss<{ paid?: boolean }>();
        if (payment?.data?.paid) {
          this.cartService.clear();
          this.uiFeedback.success('Cart payment confirmed.');
          await this.modalCtrl.dismiss();
        }
      },
      error: async () => {
        await this.loadingService.hide();
        this.isSubmitting = false;
        this.uiFeedback.error('Could not checkout cart.');
      }
    });
  }

  private async openLoginModal(): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: LoginModalComponent,
            cssClass: 'login-modal-class',
      handle: true,
      initialBreakpoint: 1,
      breakpoints: [0, 0.92, 1],
      backdropDismiss: false
    });
    await modal.present();
  }

  async closeModal(): Promise<void> {
    await this.modalCtrl.dismiss();
  }

  private refreshCartState(): void {
    this.cartCount = this.cartService.getItemCount();
    this.cartSubtotal = this.cartService.getSubtotal();
  }

  private async loadChefCoords(): Promise<void> {
    if (!this.chefID) return;
    try {
      const chef = await firstValueFrom(this.userService.getUserById(this.chefID));
      const lat = Number((chef as any)?.locationLat);
      const lng = Number((chef as any)?.locationLng);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        this.chefCoords = { lat, lng };
      }
    } catch {
      this.chefCoords = null;
    }
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

  async goToCart(): Promise<void> {
    await this.modalCtrl.dismiss();
    this.router.navigate(['/components/cart']);
  }
}
