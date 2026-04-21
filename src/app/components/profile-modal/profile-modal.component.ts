import { Component, Input, OnInit } from '@angular/core';
import { UserService } from 'src/app/services/user.service';
import { Food } from 'src/app/interface/food';
import { FoodService } from 'src/app/services/food.service';
import { ModalController } from '@ionic/angular';
import { environment } from 'src/environments/environment';
import { TokenStorageService } from 'src/app/services/token-storage.service';
import { UiFeedbackService } from 'src/app/services/ui-feedback.service';
import { LoginModalComponent } from 'src/app/login-modal/login-modal.component';
import { HttpClient } from '@angular/common/http';

interface PublicProfileSummary {
  level?: string;
  rating?: number;
  engagementLabel?: string;
  totalOrdersMade?: number;
  totalDeliveries?: number;
  dishes?: number;
  stories?: number;
  dishLikes?: number;
  storyLikes?: number;
  verificationStatus?: string;
}

interface UserDetails {
  _id: string;
  username: string;
  roles: string[];
  primaryRole: 'chef' | 'consumer' | 'dispatch' | string;
  displayRole: string;
  profilePicture?: string;
  coverPicture?: string;
  isOnline?: boolean;
  followersCount?: number;
  summary?: PublicProfileSummary;
}

@Component({
  selector: 'app-profile-modal',
  templateUrl: './profile-modal.component.html',
  styleUrls: ['./profile-modal.component.scss']
})
export class ProfileModalComponent implements OnInit {
  @Input() username!: string;
  @Input() initialStatTab?: 'followers' | 'dishes' | 'stories';
  userDetails!: UserDetails | undefined;
  chefFoods: Food[] = [];
  chefId: string | undefined;
  followers = 0;
  dishes = 0;
  stories = 0;
  dishLikes = 0;
  storyLikes = 0;
  isFollowing = false;
  currentUserId?: string;
  selectedStatTab: 'followers' | 'dishes' | 'stories' = 'dishes';
  followerList: Array<{ _id: string; username: string; profilePicture?: string }> = [];
  storyList: Array<{ _id: string; username: string; path: string; description?: string; uploadedAt?: string }> = [];
  followerPage = 1;
  storyPage = 1;
  readonly pageSize = 8;

  constructor(
    private modalController: ModalController,
    private userService: UserService,
    private foodService: FoodService,
    private http: HttpClient,
    private tokenStorage: TokenStorageService,
    private uiFeedback: UiFeedbackService
  ) {}

  ngOnInit(): void {
    const currentUser = JSON.parse(localStorage.getItem('auth-user') || 'null');
    this.currentUserId = currentUser?._id;

    this.userService.getChefProfile(this.username).subscribe(
      (data: any) => {
        data.roles = Array.isArray(data?.roles) ? data.roles : [];
        this.userDetails = data;
        this.chefId = data?._id;
        this.followers = Number(data?.followersCount || 0);
        this.dishes = Number(data?.summary?.dishes || 0);
        this.stories = Number(data?.summary?.stories || 0);
        this.dishLikes = Number(data?.summary?.dishLikes || 0);
        this.storyLikes = Number(data?.summary?.storyLikes || 0);

        if (this.isChefProfile) {
          this.selectedStatTab = this.initialStatTab || 'dishes';
          this.getFoodsByChefUsername(this.username);
          if (this.chefId) {
            this.loadFollowing(this.chefId);
            this.loadFollowersList(this.chefId);
            this.loadStoriesByChef(this.chefId);
          }
        }
      },
      (error) => {
        console.error('Error fetching profile:', error);
      }
    );
  }

  get isChefProfile(): boolean {
    return this.userDetails?.primaryRole === 'chef';
  }

  get isConsumerProfile(): boolean {
    return this.userDetails?.primaryRole === 'consumer';
  }

  get isDispatchProfile(): boolean {
    return this.userDetails?.primaryRole === 'dispatch';
  }

  get roleHeading(): string {
    return this.userDetails?.displayRole || 'User';
  }

  get levelLabel(): string {
    return this.userDetails?.summary?.level || 'Starter';
  }

  get ratingLabel(): string {
    const rating = Number(this.userDetails?.summary?.rating || 0);
    return rating > 0 ? rating.toFixed(1) : 'New';
  }

  get engagementLabel(): string {
    return this.userDetails?.summary?.engagementLabel || 'New';
  }

  get totalOrdersMade(): number {
    return Number(this.userDetails?.summary?.totalOrdersMade || 0);
  }

  get totalDeliveries(): number {
    return Number(this.userDetails?.summary?.totalDeliveries || 0);
  }

  get onlineLabel(): string {
    return this.userDetails?.isOnline ? 'Online' : 'Offline';
  }

  getFoodsByChefUsername(username: string): void {
    this.foodService.getFoodsByChefUsername(username).subscribe(
      (foods: Food[]) => {
        this.chefFoods = foods;
      },
      (error) => {
        console.error('Error fetching foods by chef username:', error);
      }
    );
  }

  loadFollowing(chefId: string): void {
    this.userService.getFollowingChefIds().subscribe(
      (data) => {
        this.isFollowing = (data.followingChefs || []).includes(chefId);
      },
      (error) => {
        console.error('Error fetching follow list:', error);
      }
    );
  }

  toggleFollow(): void {
    if (!this.isChefProfile || !this.chefId) return;
    if (!this.tokenStorage.getAccessToken()) {
      this.uiFeedback.error('Please login to follow a chef.');
      this.openLoginModal();
      return;
    }
    this.userService.toggleFollowChef(this.chefId).subscribe(
      (res) => {
        if (res.pending) {
          this.uiFeedback.success('Follow request sent. Awaiting approval.');
          this.isFollowing = false;
          return;
        }
        this.isFollowing = res.following;
        this.followers = res.followersCount;
      },
      (error) => {
        this.uiFeedback.error(error?.error?.message || 'Unable to update follow status.');
      }
    );
  }

  getImageUrl(imageName: string): string {
    const cleaned = imageName ? imageName.replace(/\\/g, '/') : '';
    if (!cleaned) {
      return '/assets/img/regpage.jpeg';
    }
    if (cleaned.startsWith('uploads/')) {
      return `${environment.baseUrl}/${cleaned}`;
    }
    if (cleaned.startsWith('profile-pictures/')) {
      return `${environment.uploadUrl}/${cleaned}`;
    }
    if (cleaned.includes('uploads/profile-pictures/')) {
      return `${environment.baseUrl}/${cleaned}`;
    }
    return `${environment.uploadUrl}/profile-pictures/${cleaned}`;
  }

  getFoodImageUrl(imageName: string): string {
    const cleaned = imageName ? imageName.replace(/\\/g, '/') : '';
    if (!cleaned) return '/assets/img/regpage.jpeg';
    if (cleaned.startsWith('uploads/')) return `${environment.baseUrl}/${cleaned}`;
    if (cleaned.includes('/')) return `${environment.baseUrl}/${cleaned}`;
    return `${environment.uploadUrl}/${cleaned}`;
  }

  getStoryUrl(path: string): string {
    const cleaned = path ? path.replace(/\\/g, '/') : '';
    if (!cleaned) return '';
    if (cleaned.startsWith('http')) return cleaned;
    return `${environment.baseUrl}/${cleaned}`;
  }

  selectStatTab(tab: 'followers' | 'dishes' | 'stories'): void {
    if (!this.isChefProfile) return;
    this.selectedStatTab = tab;
  }

  get pagedFollowers(): Array<{ _id: string; username: string; profilePicture?: string }> {
    return this.followerList.slice(0, this.followerPage * this.pageSize);
  }

  get pagedStories(): Array<{ _id: string; username: string; path: string; description?: string; uploadedAt?: string }> {
    return this.storyList.slice(0, this.storyPage * this.pageSize);
  }

  get hasMoreFollowers(): boolean {
    return this.pagedFollowers.length < this.followerList.length;
  }

  get hasMoreStories(): boolean {
    return this.pagedStories.length < this.storyList.length;
  }

  loadMoreFollowers(): void {
    this.followerPage += 1;
  }

  loadMoreStories(): void {
    this.storyPage += 1;
  }

  private loadFollowersList(chefId: string): void {
    this.http.get<any[]>(`${environment.apiUrl}/user/chef-followers/${chefId}`).subscribe({
      next: (list) => {
        this.followerList = list || [];
        this.followerPage = 1;
      },
      error: () => {
        this.followerList = [];
      }
    });
  }

  private loadStoriesByChef(chefId: string): void {
    this.http.get<any[]>(`${environment.apiUrl}/videos/by-user/${chefId}`).subscribe({
      next: (items) => {
        this.storyList = items || [];
        this.storyPage = 1;
      },
      error: () => {
        this.storyList = [];
      }
    });
  }

  closeModal(): void {
    this.modalController.dismiss();
  }

  private async openLoginModal(): Promise<void> {
    const modal = await this.modalController.create({
      component: LoginModalComponent,
      backdropDismiss: false
    });
    await modal.present();
  }
}
