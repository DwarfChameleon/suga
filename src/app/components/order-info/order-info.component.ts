import { Component, ElementRef, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { OrderService } from 'src/app/services/order.service';
import { ModalController } from '@ionic/angular';
import { TokenStorageService } from 'src/app/services/token-storage.service';
import * as QRCode from 'qrcode';
import { FoodService } from 'src/app/services/food.service';
import { environment } from 'src/environments/environment';
import { DispatchService } from 'src/app/services/dispatch.service';
import { UiFeedbackService } from 'src/app/services/ui-feedback.service';
import { NotificationSocketService } from 'src/app/services/notification-socket.service';
import { Subscription } from 'rxjs';


@Component({
  selector: 'app-order-info',
  templateUrl: './order-info.component.html',
  styleUrls: ['./order-info.component.scss'],
})
export class OrderInfoComponent  implements OnInit, OnDestroy {

  @Input() orderId!: string;
  @Input() openScanner = false;
  @ViewChild('scanVideo') scanVideoRef?: ElementRef<HTMLVideoElement>;
  @ViewChild('receiptFrame') receiptFrame?: ElementRef<HTMLElement>;
  order: any;
  orderTime: Date | undefined;
  qrDataUrl: string | null = null;
  qrExpiresAt: string | null = null;
  readableCode = '';
  isCodeVisibleToRider = false;
  isRevealingCode = false;
  isConsumer = false;
  role: 'consumer' | 'chef' | 'dispatch' = 'consumer';
  foodImageUrl = '/assets/img/regpage.jpeg';
  isDispatchUpdating = false;
  isScannerOpen = false;
  isScannerActive = false;
  scanError = '';
  manualDispatchToken = '';
  private changed = false;
  private cameraStream: MediaStream | null = null;
  private scanFrameId: number | null = null;
  private barcodeDetector: any = null;
  private notificationSub?: Subscription;
  
  constructor(
    private modalController: ModalController,
    private orderService: OrderService,
    private tokenStorage: TokenStorageService,
    private foodService: FoodService,
    private dispatchService: DispatchService,
    private uiFeedback: UiFeedbackService,
    private notificationSocket: NotificationSocketService
  ) { }

  ngOnInit() {
    this.loadOrder();
    this.notificationSub = this.notificationSocket.notifications$.subscribe((notification: any) => {
      const orderId = String(notification?.data?.orderId || '');
      const type = String(notification?.type || '');
      if (orderId !== this.orderId) return;
      if ([
        'dispatch:delivery_code_ready',
        'dispatch:assigned',
        'dispatch:status',
        'dispatch:delivered',
        'order:dispatch_payout_released',
        'order:dispatch_payout_auto_released'
      ].includes(type)) {
        this.loadOrder();
      }
    });
  }

  ngOnDestroy(): void {
    this.stopCameraScanner();
    this.notificationSub?.unsubscribe();
  }


  loadOrder() {
    this.orderService.getOrderById(this.orderId).subscribe(
      (response) => {
        this.order = { ...response };
        this.orderTime = new Date(this.order.orderTime);
        const user = this.tokenStorage.getUser();
        const roles = Array.isArray(user?.roles) ? user.roles.map((r: string) => r.toLowerCase()) : [];
        this.isConsumer = roles.includes('consumer');
        if (roles.includes('dispatch')) {
          this.role = 'dispatch';
        } else if (roles.includes('chef')) {
          this.role = 'chef';
        } else {
          this.role = 'consumer';
        }
        this.loadQrIfNeeded();
        this.loadFoodPreview();
        if (this.role === 'dispatch' && this.order?.deliveryQrReadableCode) {
          this.manualDispatchToken = String(this.order.deliveryQrReadableCode || '').trim();
        }
        if (this.role === 'dispatch' && this.openScanner && this.canDispatchDeliver()) {
          this.openScanner = false;
          this.openDeliveryScanner();
        }
      },
      (error) => {
        console.error('Error fetching order:', error);
      }
    );
  }

  get isReadOnlyCompleted(): boolean {
    return this.order?.status === 'completed';
  }

  get shouldShowQr(): boolean {
    if (!this.isConsumer) return false;
    const dispatchStatus = this.order?.dispatchStatus || 'unassigned';
    return ['assigned', 'picked_up', 'in_transit'].includes(dispatchStatus);
  }

  get canRevealCodeToRider(): boolean {
    return this.shouldShowQr && !this.isCodeVisibleToRider;
  }

  loadQrIfNeeded(): void {
    if (!this.shouldShowQr || !this.orderId) return;
    this.qrDataUrl = null;
    this.orderService.getOrderQr(this.orderId).subscribe({
      next: async (res) => {
        this.qrExpiresAt = res?.expiresAt || null;
        const token = res?.token || '';
        this.readableCode = res?.readableCode || token;
        this.isCodeVisibleToRider = !!res?.visibleToRider;
        if (token) {
          this.qrDataUrl = await QRCode.toDataURL(token);
        }
      },
      error: () => {}
    });
  }

  revealCodeToRider(): void {
    if (!this.canRevealCodeToRider || this.isRevealingCode) return;
    this.isRevealingCode = true;
    this.orderService.revealOrderQr(this.orderId).subscribe({
      next: async (res) => {
        this.isRevealingCode = false;
        this.changed = true;
        this.readableCode = res?.readableCode || res?.token || this.readableCode;
        this.qrExpiresAt = res?.expiresAt || this.qrExpiresAt;
        this.isCodeVisibleToRider = !!res?.visibleToRider;
        const token = res?.token || '';
        if (token) {
          this.qrDataUrl = await QRCode.toDataURL(token);
        }
        this.uiFeedback.success('Delivery code is now visible to the rider.');
        this.loadOrder();
      },
      error: (error) => {
        this.isRevealingCode = false;
        this.uiFeedback.error(error?.error?.error || error?.error?.message || 'Could not share code with rider.');
      }
    });
  }

  private loadFoodPreview(): void {
    const foodId = String(this.order?.food_id || this.order?.food_Id || '').trim();
    if (!foodId) return;
    this.foodService.getFoodById(foodId).subscribe({
      next: (food) => {
        const image = String(food?.image || '').trim();
        if (!image) return;
        this.foodImageUrl = `${environment.uploadUrl}/${image}`;
      },
      error: () => {}
    });
  }

  get orderStatusLabel(): string {
    const status = String(this.order?.status || '');
    const dispatchStatus = String(this.order?.dispatchStatus || 'unassigned');
    if (this.role === 'dispatch') {
      if (dispatchStatus === 'assigned' && !this.order?.dispatchAcceptedAt) return 'Waiting for your response';
      if (dispatchStatus === 'assigned') return 'Accepted, ready for pickup';
      if (dispatchStatus === 'picked_up') return 'Picked up from chef';
      if (dispatchStatus === 'in_transit') return 'On the way';
      if (dispatchStatus === 'delivered_to_customer' || status === 'delivered') return 'Waiting for customer confirmation';
      if (dispatchStatus === 'failed') return 'Delivery issue reported';
    }
    return status ? status.replace(/_/g, ' ') : 'Pending';
  }

  canDispatchAccept(): boolean {
    if (this.role !== 'dispatch') return false;
    const dispatchStatus = String(this.order?.dispatchStatus || 'unassigned');
    return dispatchStatus === 'assigned' || dispatchStatus === 'unassigned';
  }

  canDispatchDecline(): boolean {
    if (this.role !== 'dispatch') return false;
    return String(this.order?.dispatchStatus || '') === 'assigned' && !this.order?.dispatchAcceptedAt;
  }

  canDispatchPickUp(): boolean {
    if (this.role !== 'dispatch') return false;
    return String(this.order?.dispatchStatus || '') === 'assigned' && !!this.order?.dispatchAcceptedAt;
  }

  canDispatchInTransit(): boolean {
    if (this.role !== 'dispatch') return false;
    return String(this.order?.dispatchStatus || '') === 'picked_up';
  }

  canDispatchDeliver(): boolean {
    if (this.role !== 'dispatch') return false;
    return String(this.order?.dispatchStatus || '') === 'in_transit';
  }

  canDispatchFail(): boolean {
    if (this.role !== 'dispatch') return false;
    return ['assigned', 'picked_up', 'in_transit'].includes(String(this.order?.dispatchStatus || ''));
  }

  openDeliveryScanner(): void {
    if (!this.canDispatchDeliver()) return;
    this.isScannerOpen = true;
    this.scanError = '';
    if (!this.manualDispatchToken) {
      this.manualDispatchToken = String(this.order?.deliveryQrReadableCode || this.readableCode || '').trim();
    }
    setTimeout(() => {
      void this.startCameraScanner();
    }, 0);
  }

  closeDeliveryScanner(): void {
    this.stopCameraScanner();
    this.isScannerOpen = false;
  }

  private async startCameraScanner(): Promise<void> {
    if (!this.isScannerOpen || !this.canDispatchDeliver()) return;
    const video = this.scanVideoRef?.nativeElement;
    if (!video) return;

    if (!navigator.mediaDevices?.getUserMedia) {
      this.scanError = 'Camera is not supported on this device.';
      return;
    }

    const BarcodeDetectorCtor = (window as any).BarcodeDetector;
    if (!BarcodeDetectorCtor) {
      this.scanError = 'Automatic QR detection is not supported here. Use the readable code below.';
      return;
    }

    try {
      this.barcodeDetector = this.barcodeDetector || new BarcodeDetectorCtor({ formats: ['qr_code'] });
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false
      });
      this.cameraStream = stream;
      video.srcObject = stream;
      await video.play();
      this.isScannerActive = true;
      this.scanError = '';
      this.scanFrameId = window.requestAnimationFrame(() => this.scanFrame());
    } catch {
      this.scanError = 'Could not open the camera. Check permissions and try again.';
      this.stopCameraScanner();
    }
  }

  private async scanFrame(): Promise<void> {
    if (!this.isScannerOpen || !this.isScannerActive || !this.barcodeDetector) return;
    const video = this.scanVideoRef?.nativeElement;
    if (!video) return;

    if (video.readyState >= 2) {
      try {
        const codes = await this.barcodeDetector.detect(video);
        const token = String(codes?.[0]?.rawValue || '').trim();
        if (token) {
          this.manualDispatchToken = token;
          this.verifyDispatchQr(token);
          return;
        }
      } catch {
        // Keep scanning until a token is detected or the user closes the panel.
      }
    }

    this.scanFrameId = window.requestAnimationFrame(() => this.scanFrame());
  }

  private stopCameraScanner(): void {
    this.isScannerActive = false;
    if (this.scanFrameId !== null) {
      cancelAnimationFrame(this.scanFrameId);
      this.scanFrameId = null;
    }
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach((track) => track.stop());
      this.cameraStream = null;
    }
    const video = this.scanVideoRef?.nativeElement;
    if (video) {
      video.pause();
      (video as any).srcObject = null;
    }
  }

  verifyManualDispatchQr(): void {
    const token = String(this.manualDispatchToken || '').trim();
    if (!token) {
      this.uiFeedback.error('QR token required.');
      return;
    }
    this.verifyDispatchQr(token);
  }

  acceptDispatchOrder(): void {
    if (this.isDispatchUpdating || !this.orderId) return;
    this.isDispatchUpdating = true;
    this.dispatchService.acceptOrder(this.orderId).subscribe({
      next: () => {
        this.changed = true;
        this.isDispatchUpdating = false;
        this.uiFeedback.success('Order accepted.');
        this.loadOrder();
      },
      error: (error) => {
        this.isDispatchUpdating = false;
        this.uiFeedback.error(error?.error?.message || 'Could not accept order.');
      }
    });
  }

  declineDispatchOrder(): void {
    if (this.isDispatchUpdating || !this.orderId) return;
    this.isDispatchUpdating = true;
    this.dispatchService.declineOrder(this.orderId).subscribe({
      next: () => {
        this.changed = true;
        this.isDispatchUpdating = false;
        this.uiFeedback.success('Delivery request declined.');
        this.closeModal();
      },
      error: (error) => {
        this.isDispatchUpdating = false;
        this.uiFeedback.error(error?.error?.message || 'Could not decline order.');
      }
    });
  }

  updateDispatchStatus(status: 'picked_up' | 'in_transit' | 'failed'): void {
    if (this.isDispatchUpdating || !this.orderId) return;
    this.isDispatchUpdating = true;
    this.dispatchService.updateOrderStatus(this.orderId, status).subscribe({
      next: () => {
        this.changed = true;
        this.isDispatchUpdating = false;
        this.uiFeedback.success(`Order marked ${status.replace('_', ' ')}.`);
        this.loadOrder();
      },
      error: (error) => {
        this.isDispatchUpdating = false;
        this.uiFeedback.error(error?.error?.message || 'Status update failed.');
      }
    });
  }

  async completeDispatchDelivery(): Promise<void> {
    this.openDeliveryScanner();
  }

  private verifyDispatchQr(token: string): void {
    if (this.isDispatchUpdating || !this.orderId) return;
    this.isDispatchUpdating = true;
    this.dispatchService.verifyDeliveryQr(this.orderId, token).subscribe({
      next: () => {
        this.changed = true;
        this.isDispatchUpdating = false;
        this.stopCameraScanner();
        this.isScannerOpen = false;
        this.uiFeedback.success('Delivery verified.');
        this.loadOrder();
      },
      error: (error) => {
        this.isDispatchUpdating = false;
        this.uiFeedback.error(error?.error?.error || error?.error?.message || 'QR verification failed.');
      }
    });
  }

  closeModal() {
    this.stopCameraScanner();
    this.modalController.dismiss({ changed: this.changed });
  }

  private receiptBaseName(): string {
    return `suga-order-${this.orderId || 'receipt'}`;
  }

  async downloadReceiptImage(): Promise<void> {
    const svg = this.buildReceiptSvg();
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const link = document.createElement('a');
    link.download = `${this.receiptBaseName()}.svg`;
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async printReceipt(): Promise<void> {
    const svg = this.buildReceiptSvg();
    const printWindow = window.open('', '_blank', 'width=900,height=1100');
    if (!printWindow) {
      this.uiFeedback.error('Popup blocked. Allow popups to print the receipt.');
      return;
    }

    printWindow.document.open();
    printWindow.document.write(`
      <html>
        <head>
          <title>${this.receiptBaseName()}</title>
          <style>
            html, body { margin: 0; padding: 0; background: #fff; }
            svg { width: 100%; height: auto; display: block; }
          </style>
        </head>
        <body>
          ${svg}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  private buildReceiptSvg(): string {
    const order = this.order || {};
    const lines: Array<[string, string]> = [
      ['Order', this.escapeXml(String(order?.dishName || 'Order'))],
      ['Ordered by', this.escapeXml(String(order?.username || '—'))],
      ['Chef', this.escapeXml(`@${order?.chefUsername || '—'}`)],
      ['Price', this.escapeXml(String(order?.price || '0'))],
      ['Order status', this.escapeXml(this.orderStatusLabel || 'Pending')],
      ['Dispatch status', this.escapeXml(String(order?.dispatchStatus || 'unassigned').replace(/_/g, ' '))]
    ];
    if (this.order?.deliveryFee) {
      lines.push(['Delivery fee', this.escapeXml(String(order.deliveryFee))]);
    }
    if (this.order?.deliveryQrReadableCode) {
      lines.push(['Delivery code', this.escapeXml(String(order.deliveryQrReadableCode))]);
    }

    const height = 280 + lines.length * 44;
    const qrBlock = this.qrDataUrl
      ? `<image href="${this.qrDataUrl}" x="540" y="120" width="220" height="220" preserveAspectRatio="xMidYMid meet" />`
      : '';

    const rows = lines
      .map((line, index) => {
        const y = 170 + index * 44;
        return `
          <text x="80" y="${y}" font-size="14" fill="#64748b" font-family="Arial, sans-serif">${line[0]}</text>
          <text x="240" y="${y}" font-size="16" fill="#0f172a" font-weight="700" font-family="Arial, sans-serif">${line[1]}</text>
        `;
      })
      .join('');

    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="820" height="${height}" viewBox="0 0 820 ${height}">
        <rect width="820" height="${height}" rx="28" fill="#ffffff" />
        <rect x="0" y="0" width="820" height="96" rx="28" fill="#f97316" />
        <text x="80" y="54" font-size="28" fill="#ffffff" font-family="Arial, sans-serif" font-weight="700">SUGA Receipt</text>
        <text x="80" y="82" font-size="14" fill="rgba(255,255,255,0.88)" font-family="Arial, sans-serif">${this.escapeXml(this.receiptBaseName())}</text>
        ${rows}
        <rect x="520" y="96" width="250" height="250" rx="22" fill="#fff7ed" stroke="#fed7aa" />
        ${qrBlock}
        <text x="555" y="366" font-size="12" fill="#f97316" font-family="Arial, sans-serif">Show this code at delivery</text>
      </svg>
    `;
  }

  private escapeXml(value: string): string {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

}
