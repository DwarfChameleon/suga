import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { ModalController } from '@ionic/angular';
import { OrderInfoComponent } from '../order-info/order-info.component';
import { ProfileModalComponent } from '../profile-modal/profile-modal.component';
import { FoodProfileComponent } from '../food-profile/food-profile.component';
import { CategoryModalComponent } from '../category-modal/category-modal.component';
import { UserService } from 'src/app/services/user.service';
import { Router } from '@angular/router';
import { humanizeHistoryLabel } from 'src/app/utils/history-formatters';

interface RewardEvent {
  _id?: string;
  action: string;
  points: number;
  tokens: number;
  createdAt: string;
  meta?: any;
}

@Component({
  selector: 'app-rewards',
  templateUrl: './rewards.component.html',
  styleUrls: ['./rewards.component.scss']
})
export class RewardsComponent implements OnInit {
  history: RewardEvent[] = [];
  guidelines: Array<{ action: string; points: number }> = [];
  activity: Array<{ day: string; points: number }> = [];
  tips: string[] = [];
  isLoading = true;
  selectedHistory: RewardEvent | null = null;
  sections = {
    trend: true,
    guidelines: true,
    history: true,
    tips: true
  };

  constructor(
    private http: HttpClient,
    private modalController: ModalController,
    private userService: UserService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadAll();
  }

  async loadAll(): Promise<void> {
    this.isLoading = true;
    try {
      const [historyRes, guidelinesRes, activityRes] = await Promise.all([
        this.http.get<any>(`${environment.apiUrl}/wallet/rewards/history?limit=50`).toPromise(),
        this.http.get<any>(`${environment.apiUrl}/wallet/rewards/guidelines`).toPromise(),
        this.http.get<any>(`${environment.apiUrl}/wallet/rewards/activity?days=14`).toPromise()
      ]);

      this.history = historyRes?.rows || [];
      this.guidelines = guidelinesRes?.guidelines || [];
      this.activity = (activityRes?.data || []).map((d: any) => ({
        day: d._id,
        points: d.points || 0
      }));
      this.tips = this.buildTips();
    } catch {
      this.history = [];
      this.guidelines = [];
      this.activity = [];
      this.tips = [];
    } finally {
      this.isLoading = false;
    }
  }

  private buildTips(): string[] {
    const tips: string[] = [];
    const highest = [...this.guidelines].sort((a, b) => b.points - a.points)[0];
    if (highest) {
      tips.push(`Most rewarding: ${highest.action} (+${highest.points} pts).`);
    }
    tips.push('Keep a streak: complete orders and engage with chefs.');
    return tips;
  }

  maxPoints(): number {
    return Math.max(1, ...this.activity.map((a) => a.points || 0));
  }

  toggleSection(section: keyof RewardsComponent['sections']): void {
    this.sections[section] = !this.sections[section];
  }

  displayHistoryLabel(row: RewardEvent): string {
    return humanizeHistoryLabel(row?.action);
  }

  selectHistory(row: RewardEvent): void {
    this.selectedHistory = this.selectedHistory?._id === row._id ? null : row;
  }

  async openOrder(orderId?: string): Promise<void> {
    if (!orderId) return;
    const modal = await this.modalController.create({
      component: OrderInfoComponent,
      componentProps: { orderId }
    });
    await modal.present();
  }

  async openChefProfileById(chefId?: string): Promise<void> {
    if (!chefId) return;
    this.userService.getUserById(chefId).subscribe({
      next: async (chef: any) => {
        if (!chef?.username) return;
        const modal = await this.modalController.create({
          component: ProfileModalComponent,
          componentProps: { username: chef.username }
        });
        await modal.present();
      },
      error: () => {}
    });
  }

  async openFood(foodId?: string): Promise<void> {
    if (!foodId) return;
    const modal = await this.modalController.create({
      component: FoodProfileComponent,
      componentProps: { foodId }
    });
    await modal.present();
  }

  async openCategory(category?: string): Promise<void> {
    if (!category) return;
    const modal = await this.modalController.create({
      component: CategoryModalComponent,
      componentProps: { category }
    });
    await modal.present();
  }

  openStoryPage(): void {
    this.router.navigate(['/components/story']);
  }
}
