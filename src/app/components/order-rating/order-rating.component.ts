import { Component, Input } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { OrderService } from 'src/app/services/order.service';
import { UiFeedbackService } from 'src/app/services/ui-feedback.service';

@Component({
  selector: 'app-order-rating',
  templateUrl: './order-rating.component.html',
  styleUrls: ['./order-rating.component.scss']
})
export class OrderRatingComponent {
  @Input() orderId!: string;
  @Input() dishName = '';

  stars = 0;
  comment = '';
  isSubmitting = false;

  constructor(
    private readonly modalController: ModalController,
    private readonly orderService: OrderService,
    private readonly uiFeedback: UiFeedbackService
  ) {}

  setStars(value: number): void {
    this.stars = value;
  }

  async close(): Promise<void> {
    await this.modalController.dismiss();
  }

  submit(): void {
    if (!this.orderId) return;
    if (this.stars < 1) {
      this.uiFeedback.error('Please select a rating.');
      return;
    }
    this.isSubmitting = true;
    this.orderService.submitOrderRating(this.orderId, this.stars, this.comment).subscribe({
      next: async () => {
        this.uiFeedback.success('Thanks for your review! +5 points');
        this.isSubmitting = false;
        await this.modalController.dismiss({ rated: true });
      },
      error: (err) => {
        this.isSubmitting = false;
        this.uiFeedback.error(err?.error?.error || 'Unable to submit rating.');
      }
    });
  }
}
