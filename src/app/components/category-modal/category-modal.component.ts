import { Component, Input, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { FoodService, FoodCategory } from 'src/app/services/food.service';
import { Food } from 'src/app/interface/food';
import { FoodProfileComponent } from '../food-profile/food-profile.component';
import { resolveUploadUrl } from 'src/app/utils/media-url';

@Component({
  selector: 'app-category-modal',
  templateUrl: './category-modal.component.html',
  styleUrls: ['./category-modal.component.scss']
})
export class CategoryModalComponent implements OnInit {
  @Input() category = '';
  @Input() country = '';
  @Input() state = '';
  @Input() categoryImages: string[] = [];

  foods: Food[] = [];
  loading = true;
  error = '';
  profileImages: string[] = [];
  activeProfileIndex = 0;
  private brokenProfileImages = new Set<string>();

  constructor(
    private modalController: ModalController,
    private foodService: FoodService
  ) {}

  ngOnInit(): void {
    if (!this.category) {
      this.loading = false;
      return;
    }

    this.loadCategoryProfile();
    this.loadFoods();
  }

  private loadFoods(): void {
    this.foodService.getFoodsByCategory(this.category, { country: this.country, state: this.state }).subscribe({
      next: (data) => {
        this.foods = data || [];
        this.loading = false;
      },
      error: () => {
        this.error = 'Failed to load foods for this category.';
        this.loading = false;
      }
    });
  }

  private loadCategoryProfile(): void {
    const inputImages = this.normalizeCategoryImages({ images: this.categoryImages });
    if (inputImages.length) {
      this.profileImages = inputImages;
    }

    this.foodService.getCategoryList().subscribe({
      next: (categories) => {
        const match = (categories || []).find((item) => this.normalizeText(item?.name) === this.normalizeText(this.category));
        const matchedImages = this.normalizeCategoryImages(match);
        this.profileImages = matchedImages.length ? matchedImages : (this.profileImages.length ? this.profileImages : ['/assets/img/regpage.jpeg']);
      },
      error: () => {
        this.profileImages = this.profileImages.length ? this.profileImages : ['/assets/img/regpage.jpeg'];
      }
    });
  }

  private normalizeCategoryImages(category?: Partial<FoodCategory>): string[] {
    const images = Array.isArray(category?.images) && category?.images?.length
      ? category.images
      : (category?.image ? [category.image] : []);

    return Array.from(new Set(images.filter(Boolean))).slice(0, 4);
  }

  private normalizeText(value: string | undefined): string {
    return String(value || '').trim().toLowerCase();
  }

  onProfileScroll(event: Event): void {
    const target = event.target as HTMLElement | null;
    if (!target || !this.profileImages.length) return;
    const width = Math.max(target.clientWidth, 1);
    const index = Math.round(target.scrollLeft / width);
    this.activeProfileIndex = Math.max(0, Math.min(this.profileImages.length - 1, index));
  }

  getImageUrl(image: string): string {
    return resolveUploadUrl(image, '/assets/img/regpage.jpeg');
  }

  getCategoryProfileImageUrl(image: string): string {
    const normalized = String(image || '').trim().replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
    if (!normalized || this.brokenProfileImages.has(normalized)) return '/assets/img/regpage.jpeg';
    if (normalized.startsWith('/assets/')) return normalized;
    return resolveUploadUrl(normalized, '/assets/img/regpage.jpeg');
  }

  onProfileImageError(image: string): void {
    const normalized = String(image || '').trim().replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
    if (normalized) this.brokenProfileImages.add(normalized);
  }

  close(): void {
    this.modalController.dismiss();
  }

  async openFoodProfile(foodId: string): Promise<void> {
    if (!foodId) return;

    const foodProfileModal = await this.modalController.create({
      component: FoodProfileComponent,
      componentProps: { foodId },
      cssClass: 'suga-food-profile-sheet',
      handle: true,
      initialBreakpoint: 0.9,
      breakpoints: [0, 0.58, 0.9, 1]
    });

    await this.modalController.dismiss();
    await foodProfileModal.present();
  }
}
