import { Component, ElementRef, HostListener, OnInit, ViewChild } from '@angular/core';
import { FoodService } from 'src/app/services/food.service';
import { Router } from '@angular/router';
import { Food } from 'src/app/interface/food';
import { UserService } from 'src/app/services/user.service';
import { FoodProfileComponent } from '../food-profile/food-profile.component';
import { OrderModalComponent } from '../order-modal/order-modal.component';
import { UserDetails } from 'src/app/interface/user-details';
import { OrderService } from 'src/app/services/order.service';
import { ModalController } from '@ionic/angular';
import { environment } from 'src/environments/environment';
import { ProfileModalComponent } from '../profile-modal/profile-modal.component';
import { TokenStorageService } from 'src/app/services/token-storage.service';
import { LoginModalComponent } from 'src/app/login-modal/login-modal.component';
import { UiFeedbackService } from 'src/app/services/ui-feedback.service';
import { CategoryModalComponent } from '../category-modal/category-modal.component';
import { NetworkService } from 'src/app/services/network.service';
import { FoodCategory } from 'src/app/services/food.service';
import { LikeEffectsService } from 'src/app/services/like-effects.service';
import { NotificationService } from 'src/app/services/notification.service';
import { HttpClient } from '@angular/common/http';
import { resolveUploadUrl } from 'src/app/utils/media-url';
import { StoryComponent } from '../story/story.component';

interface StoryVideoItem {
  _id: string;
  userId: string;
  username: string;
  path: string;
  description?: string;
  uploadedAt?: string;
}

interface StoryChefGroup {
  chefId: string;
  username: string;
  profilePicture: string;
  videos: StoryVideoItem[];
  unseenCount: number;
  latestThumb: string;
}

@Component({
  selector: 'app-explore',
  templateUrl: './explore.component.html',
  styleUrls: ['./explore.component.scss'],
})
export class ExploreComponent implements OnInit {
 
  allFoods: Food[] = [];
  public errorMessage: string = '';
  foods: Food[] = [];
  userDetails: UserDetails | undefined;
  loggedInUser: UserDetails | undefined;
  count: number|undefined;
  foodId!: string;
  // store counts per food id
  foodCounts: Record<string, number> = {};
  chefs: Array<{ _id: string; username: string; profilePicture: string; dishCount: number; followersCount: number; score: number }> = [];
  followedChefIds = new Set<string>();
  emptyFollowMessage = '';
  isConsumer = false;
  canFollowChefs = false;
  canUseFollowedFeed = false;
  categories: FoodCategory[] = [];
  isLoading = false;
  isOnline = true;
  showCommentsModal = false;
  showImagePreview = false;
  isExploreModalOpen = false;
  activeCommentFood: Food | null = null;
  activePreviewFood: Food | null = null;
  imagePreviewZoom = 1;
  commentDraft = '';
  likedFoodIds = new Set<string>();
  foodHeartBursts: Record<string, number[]> = {};
  private exploreModalDepth = 0;
  unreadNotifications = 0;
  missedStoriesCount = 0;
  storyGroups: StoryChefGroup[] = [];
  showStoryViewer = false;
  activeStoryGroup: StoryChefGroup | null = null;
  activeStoryIndex = 0;
  activeStoryPaused = false;
  viewerPlaybackHint: 'play' | 'pause' | '' = '';
  activeStoryProgress = 0;
  @ViewChild('viewerVideo') viewerVideoRef?: ElementRef<HTMLVideoElement>;
  private viewerHintTimer?: any;
  private touchStartX = 0;
  private touchEndX = 0;
  private seenStoryIds = new Set<string>();
  private brokenCategoryImages = new Set<string>();
  private brokenStoryThumbChefs = new Set<string>();
  private brokenViewerStoryIds = new Set<string>();
  private brokenFoodImages = new Set<string>();
  private loadedCategoryImages = new Set<string>();
  private loadedFoodImages = new Set<string>();
  private dietPreferences = { allergies: [] as string[], desiredIngredients: [] as string[] };

  
  constructor(
    private foodService: FoodService, 
    private route: Router,
    private userService: UserService,
    private modalController: ModalController,
    private orderService:OrderService,
    private tokenStorage: TokenStorageService,
    private uiFeedback: UiFeedbackService,
    private networkService: NetworkService,
    private likeEffects: LikeEffectsService,
    private notificationService: NotificationService,
    private http: HttpClient
  ) {}

  ngOnInit() {
    this.loadCategories();
    this.refreshAuthDependentData();
    this.tokenStorage.authState$.subscribe(() => {
      this.refreshAuthDependentData();
    });
    this.networkService.online$.subscribe((online) => {
      this.isOnline = online;
    });
    this.notificationService.loadInitial();
    this.notificationService.getUnreadCount().subscribe((count) => {
      this.unreadNotifications = count || 0;
    });
    this.userService.followChanged$.subscribe((change) => {
      if (change?.chefId) {
        this.applyFollowChange(change);
      }
      this.loadMissedStoriesCount();
      this.loadStoryGroups();
    });
    this.loadMissedStoriesCount();
    this.hydrateSeenStoryIds();
    this.loadStoryGroups();
  // counts are loaded after foods are fetched
  }

  @HostListener('window:focus')
  onWindowFocus(): void {
    this.loadMissedStoriesCount();
    this.notificationService.loadInitial();
    this.loadStoryGroups();
  }

  refresh(event: any): void {
    this.loadCategories();
    this.refreshAuthDependentData();
    this.loadMissedStoriesCount();
    this.loadStoryGroups();
    const refresher = event?.target as HTMLIonRefresherElement | null;
    setTimeout(() => refresher?.complete(), 700);
  }

  private refreshAuthDependentData(): void {
    const roles = (this.tokenStorage.getRoles() || []).map((r) => String(r || '').toLowerCase());
    this.isConsumer = roles.includes('consumer');
    this.canUseFollowedFeed = roles.includes('consumer') || roles.includes('dispatch');
    this.canFollowChefs = roles.includes('consumer') || roles.includes('dispatch') || roles.includes('chef');
    this.hydrateSeenStoryIds();
    this.loadUserPreferences();
    this.loadFollowingChefs();
    this.getAllFoods();
    this.loadStoryGroups();
  }

  private get currentUserId(): string {
    return this.tokenStorage.getUser()?._id || '';
  }
  
  // fetch count for a single food id
  countOrder(foodId: string): void{
    if (!foodId) return;
    this.orderService.countOrders(foodId).subscribe(
      response=>{
        this.foodCounts[foodId] = response.count ?? 0;
      }, error => {
        console.error('Error fetching count for', foodId, error);
        this.foodCounts[foodId] = 0;
      }
    );
  }

getBackgroundImageStyle(imageUrl:string): any{
  return{
    'background-image':`url(${imageUrl})`,
    'background-size': 'cover',
    'background-position':'center'
  };
}

  openAccount(): void {
    const token = this.tokenStorage.getAccessToken();
    if (!token) {
      this.openLoginModal();
      return;
    }
    const roles = (this.tokenStorage.getRoles() || []).map((r) => String(r || '').toLowerCase());
    if (roles.includes('chef')) {
      this.route.navigate(['/components/chef']);
      return;
    }
    if (roles.includes('dispatch')) {
      this.route.navigate(['/components/dispatch']);
      return;
    }
    if (roles.includes('consumer')) {
      this.route.navigate(['/components/consumer']);
      return;
    }
    this.route.navigate(['/components/explore']);
  }

  async openModalFood(foodId: string) {
    this.closeCommentsModal();
    this.fetchFood(foodId);
    const modal = await this.modalController.create({
      component: FoodProfileComponent,
      componentProps: { foodId },
      cssClass: 'suga-food-profile-sheet',
      handle: true,
      initialBreakpoint: 0.9,
      breakpoints: [0, 0.58, 0.9, 1]
    });
    await this.presentExploreModal(modal);
  }

  async openChefProfile(username: string) {
    this.closeCommentsModal();
    const modal = await this.modalController.create({
      component: ProfileModalComponent,
      componentProps: { username },
      cssClass: 'suga-profile-sheet',
      handle: true,
      initialBreakpoint: 0.82,
      breakpoints: [0, 0.58, 0.82, 0.96]
    });
    await this.presentExploreModal(modal);
  }

  async openCategoryModal(categoryData: FoodCategory | string): Promise<void> {
    this.closeCommentsModal();
    const categoryName = typeof categoryData === 'string' ? categoryData : categoryData?.name || '';
    const categoryImages = typeof categoryData === 'string'
      ? []
      : (Array.isArray(categoryData?.images) && categoryData.images.length
          ? categoryData.images
          : (categoryData?.image ? [categoryData.image] : []));
    const modal = await this.modalController.create({
      component: CategoryModalComponent,
      componentProps: {
        category: categoryName,
        categoryImages,
        country: this.userDetails?.country || '',
        state: this.userDetails?.city || ''
      }
    });
    await this.presentExploreModal(modal);
  }

  fetchFood(foodId: string) {
    this.foodService.getFoodById(foodId).subscribe(
      (food: Food) => {
        console.log('Fetched food:', food);
      },
      (error: any) => {
        console.error('Error fetching food:', error);
      }
    );
  }

  async openOrderModal(food: Food) {
    this.closeCommentsModal();
    const chefID = (food as any).chefID || (food as any).chefId || (food as any).createdBy;
    const modal = await this.modalController.create({
      component: OrderModalComponent,
      componentProps: {
        dishName: food.dishName,
        price: food.price,
        priceCurrency: food.priceCurrency,
        preparationTime: food.preparationTime,
        chefName: food.chefName,
        chefID,
        food_id: food._id,
        image: (food as any).image,
        category: (food as any).category,
        user: this.loggedInUser
      }
    });
    await this.presentExploreModal(modal);
  }

 
 
  async openStoryPage(): Promise<void> {
    await this.openStoryModal();
  }

  shouldShowExploreBottomToolbar(): boolean {
    return !this.showCommentsModal && !this.showStoryViewer && !this.showImagePreview && !this.isExploreModalOpen;
  }

  openImagePreview(food: Food, event?: Event): void {
    event?.stopPropagation();
    this.closeCommentsModal();
    this.activePreviewFood = food;
    this.imagePreviewZoom = 1;
    this.showImagePreview = true;
  }

  closeImagePreview(): void {
    this.showImagePreview = false;
    this.activePreviewFood = null;
    this.imagePreviewZoom = 1;
  }

  zoomImagePreview(delta: number): void {
    const next = this.imagePreviewZoom + delta;
    this.imagePreviewZoom = Math.max(1, Math.min(3, Number(next.toFixed(2))));
  }
 
  async foodStory(): Promise<void> {
    if (this.storyGroups.length > 0) {
      this.openStoryViewer(this.storyGroups[0]);
      return;
    }
    await this.openStoryModal();
  }

  private async openStoryModal(initialVideoId = ''): Promise<void> {
    const modal = await this.modalController.create({
      component: StoryComponent,
      componentProps: { presentedAsModal: true, initialVideoId },
      cssClass: 'story-sheet-modal',
      handle: true,
      initialBreakpoint: 0.92,
      breakpoints: [0, 0.55, 0.92, 1]
    });
    await this.presentExploreModal(modal);
  }

  private async presentExploreModal(modal: any): Promise<void> {
    this.exploreModalDepth += 1;
    this.isExploreModalOpen = true;
    modal.onDidDismiss().then(() => {
      this.exploreModalDepth = Math.max(0, this.exploreModalDepth - 1);
      this.isExploreModalOpen = this.exploreModalDepth > 0;
    });
    await modal.present();
  }

  openNotifications(): void {
    this.route.navigate(['/components/notifications']);
  }

  goToSearch(): void {
    this.route.navigate(['/components/search']);
  }

  openChefDirectory(): void {
    this.route.navigate(['/components/chefs']);
  }

  loadUserPreferences(): void {
    const storedUser = this.tokenStorage.getUser();
    this.dietPreferences = {
      allergies: this.normalizeDietTags(storedUser?.dietPreferences?.allergies),
      desiredIngredients: this.normalizeDietTags(storedUser?.dietPreferences?.desiredIngredients)
    };

    if (!this.tokenStorage.getAccessToken()) return;
    this.userService.getUserPreferences().subscribe(
      (data: UserDetails) => {
        this.userDetails = data;
        const preferences = (data as any)?.dietPreferences;
        if (preferences) {
          this.dietPreferences = {
            allergies: this.normalizeDietTags(preferences.allergies),
            desiredIngredients: this.normalizeDietTags(preferences.desiredIngredients)
          };
        }
      },
      (error) => {
        if (error?.status === 401) {
          this.tokenStorage.signOut();
          this.isConsumer = false;
          this.canUseFollowedFeed = false;
          this.getAllFoods();
          return;
        }
        console.error('Error fetching user preferences:', error);
      }
    );
  }

  getFoodRecommendationTag(food: Food): 'suggested' | 'not_recommended' | '' {
    const allergies = this.dietPreferences.allergies;
    const desired = this.dietPreferences.desiredIngredients;
    if (!allergies.length && !desired.length) return '';

    const ingredients = this.getFoodIngredientList(food);
    if (allergies.some((item) => ingredients.includes(item))) return 'not_recommended';
    if (desired.some((item) => ingredients.includes(item))) return 'suggested';
    return '';
  }

  private getFoodIngredientList(food: Food | any): string[] {
    const source = Array.isArray(food?.ingredientsList) && food.ingredientsList.length
      ? food.ingredientsList
      : String(food?.ingredients || food?.additionalDetails?.ingredients || '').split(/[\n,]/);
    return this.normalizeDietTags(source);
  }

  private normalizeDietTags(value: any): string[] {
    const source = Array.isArray(value) ? value : String(value || '').split(/[\n,]/);
    return [...new Set(source.map((item: any) => String(item || '').trim().toLowerCase()).filter(Boolean))];
  }

  getAllFoods(): void {
    this.isLoading = true;
    const source$ = this.canUseFollowedFeed
      ? this.foodService.getFollowedFoods()
      : this.foodService.getAllFoods();

    source$.subscribe(
      data => {
        this.allFoods = [...data].sort((a, b) => {
          const aTime = new Date((a as any).createdAt || 0).getTime();
          const bTime = new Date((b as any).createdAt || 0).getTime();
          return bTime - aTime;
        });
        this.isLoading = false;
        this.emptyFollowMessage = '';
        this.hydrateLikedFoods();
        // after foods are loaded, request counts for each
        this.allFoods.forEach(f => {
          if (f._id) this.countOrder(f._id);
        });
        if (this.canUseFollowedFeed && this.allFoods.length === 0) {
          this.emptyFollowMessage = 'You have not followed any chef yet. Follow chef to see their contents.';
        }
      },
      error => {
        this.isLoading = false;
        if (error?.status === 401) {
          this.tokenStorage.signOut();
          this.isConsumer = false;
          this.canUseFollowedFeed = false;
          this.foodService.getAllFoods().subscribe({
            next: (data) => {
              this.allFoods = data;
              this.isLoading = false;
              this.hydrateLikedFoods();
              this.allFoods.forEach(f => {
                if (f._id) this.countOrder(f._id);
              });
            },
            error: (err) => console.error('Error fetching food details:', err)
          });
          return;
        }
        this.errorMessage = 'Error fetching food details';
        console.error(error);
      }
    );
  }

  loadChefSummaries(): void {
    this.userService.getChefSummaries().subscribe(
      data => {
        this.chefs = data;
      },
      error => {
        console.error('Error fetching chef summaries:', error);
      }
    );
  }

  loadFollowingChefs(): void {
    if (!this.canFollowChefs) return;
    this.userService.getFollowingChefIds().subscribe(
      data => {
        this.followedChefIds = new Set(data.followingChefs || []);
        this.loadMissedStoriesCount();
      },
      error => {
        if (error?.status === 401) {
          this.tokenStorage.signOut();
          this.isConsumer = false;
          this.canUseFollowedFeed = false;
          this.getAllFoods();
          return;
        }
        console.error('Error fetching following list:', error);
      }
    );
  }

  toggleFollow(chefId: string, event?: Event): void {
    if (event) event.stopPropagation();
    if (!this.canFollowChefs) return;
    if (!this.tokenStorage.getAccessToken()) {
      this.uiFeedback.error('Please login to follow chefs.');
      this.openLoginModal();
      return;
    }
    this.userService.toggleFollowChef(chefId).subscribe(
      (res) => {
        const wasFollowing = this.followedChefIds.has(chefId);
        if (res.pending) {
          this.uiFeedback.success('Follow request sent. Awaiting chef approval.');
        } else if (res.following) {
          this.followedChefIds.add(chefId);
          this.uiFeedback.success('Chef followed successfully.');
        } else {
          this.followedChefIds.delete(chefId);
          this.uiFeedback.success('Chef unfollowed.');
        }
        if (!res.pending) {
          const delta = res.following && !wasFollowing ? 1 : (!res.following && wasFollowing ? -1 : 0);
          this.chefs = this.chefs.map((chef) =>
            String(chef._id) === String(chefId)
              ? {
                  ...chef,
                  followersCount: Number.isFinite(Number(res.followersCount))
                    ? Number(res.followersCount)
                    : Math.max(0, Number(chef.followersCount || 0) + delta)
                }
              : chef
          );
        }
        this.loadFollowingChefs();
        this.getAllFoods();
      },
      (error) => {
        this.uiFeedback.error(error?.error?.message || 'Unable to update follow status.');
      }
    );
  }

  isFollowing(chefId: string): boolean {
    return this.followedChefIds.has(chefId);
  }

  private applyFollowChange(change: { chefId: string; following: boolean; pending?: boolean; followersCount?: number; followingChefs?: string[] }): void {
    const chefId = String(change.chefId || '');
    if (!chefId || change.pending) return;
    if (change.following) {
      this.followedChefIds.add(chefId);
    } else {
      this.followedChefIds.delete(chefId);
    }
    if (Array.isArray(change.followingChefs)) {
      this.followedChefIds = new Set(change.followingChefs.map((id) => String(id)));
    }
    this.chefs = this.chefs.map((chef) =>
      String(chef._id) === chefId && Number.isFinite(Number(change.followersCount))
        ? { ...chef, followersCount: Number(change.followersCount) }
        : chef
    );
  }

  private async openLoginModal(): Promise<void> {
    this.closeCommentsModal();
    const modal = await this.modalController.create({
      component: LoginModalComponent,
            cssClass: 'login-modal-class',
      handle: true,
      initialBreakpoint: 1,
      breakpoints: [0, 0.92, 1],
      backdropDismiss: false
    });
    await this.presentExploreModal(modal);
  }

  loadCategories(): void {
    this.foodService.getCategoryList().subscribe({
      next: (list) => {
        const categoryList = (list || []).map((item: any) =>
          typeof item === 'string'
            ? { name: item, image: '', images: [] }
            : { name: item?.name || '', image: item?.image || '', images: Array.isArray(item?.images) ? item.images : [] }
        ).filter((item: FoodCategory) => !!item.name);
        this.foodService.getAllFoods().subscribe({
          next: (foods) => {
            this.categories = this.getCategoriesWithFoods(categoryList, foods || []);
            this.preloadCategoryImages();
          },
          error: () => {
            this.categories = this.getCategoriesWithFoods(categoryList, this.allFoods || []);
            this.preloadCategoryImages();
          }
        });
      },
      error: () => {
        this.foodService.getAllFoods().subscribe(
          data => {
            const set = new Set<string>();
            data.forEach(f => {
              if (f.category) set.add(f.category);
            });
            this.categories = Array.from(set).map((name) => ({ name, image: '', images: [] }));
            this.preloadCategoryImages();
          },
          err => {
            console.error('Error fetching categories:', err);
          }
        );
      }
    });
  }

  likeFood(foodId: string): void {
    if (!foodId) return;
    if (!this.tokenStorage.getAccessToken()) {
      this.uiFeedback.error('Please login to like a dish.');
      this.openLoginModal();
      return;
    }
    if (this.isFoodLiked(foodId)) {
      this.uiFeedback.error(this.likeEffects.alreadyLikedMessage);
      return;
    }
    this.foodService.likeFood(foodId).subscribe({
      next: (data) => {
        this.likedFoodIds.add(foodId);
        this.allFoods = this.allFoods.map((food) =>
          food._id === foodId
            ? {
                ...food,
                likes: typeof data?.likes === 'number' ? data.likes : (food.likes || 0) + 1
              }
            : food
        );
        this.triggerFoodHeartBurst(foodId);
      },
      error: (err) => {
        if (err?.status === 400) {
          this.uiFeedback.error(this.likeEffects.alreadyLikedMessage);
          return;
        }
        console.error('Error liking food:', err);
      }
    });
  }

  isFoodLiked(foodId: string): boolean {
    return this.likedFoodIds.has(foodId);
  }

  private hydrateLikedFoods(): void {
    const userId = this.currentUserId;
    this.likedFoodIds.clear();
    if (!userId) return;
    this.allFoods.forEach((food) => {
      const likedBy = Array.isArray(food.likedBy) ? food.likedBy : [];
      if (likedBy.includes(userId)) {
        this.likedFoodIds.add(food._id);
      }
    });
  }

  private triggerFoodHeartBurst(foodId: string): void {
    this.likeEffects.applyHeartBurst(this.foodHeartBursts, foodId);
  }

  openComments(food: Food): void {
    this.activeCommentFood = this.allFoods.find((item) => item._id === food._id) || food;
    this.commentDraft = '';
    this.showCommentsModal = true;
  }

  private getCategoriesWithFoods(categories: FoodCategory[], foods: Food[]): FoodCategory[] {
    const available = new Set(
      (foods || [])
        .map((food) => String((food as any)?.category || '').trim().toLowerCase())
        .filter(Boolean)
    );
    if (!available.size) return [];
    return (categories || []).filter((category) => available.has(String(category?.name || '').trim().toLowerCase()));
  }

  closeCommentsModal(): void {
    this.showCommentsModal = false;
    this.activeCommentFood = null;
    this.commentDraft = '';
  }

  submitActiveComment(event?: Event): void {
    event?.preventDefault();
    const activeFood = this.activeCommentFood;
    if (!activeFood?._id) {
      return;
    }
    if (!this.tokenStorage.getAccessToken()) {
      this.uiFeedback.error('Please login to comment.');
      this.openLoginModal();
      return;
    }
    const text = this.commentDraft.trim();
    if (!text) return;
    this.foodService.addComment(activeFood._id, text).subscribe({
      next: (updatedFood) => {
        this.allFoods = this.allFoods.map((food) => food._id === updatedFood._id ? updatedFood : food);
        this.foods = this.foods.map((food) => food._id === updatedFood._id ? updatedFood : food);
        this.activeCommentFood = updatedFood;
        this.commentDraft = '';
        this.uiFeedback.success('Comment posted.');
      },
      error: () => this.uiFeedback.error('Failed to post comment.')
    });
  }

  getImageUrl(image: string): string {
    const normalized = this.normalizeMediaPath(image);
    if (!normalized || this.brokenFoodImages.has(normalized)) {
      return '/assets/img/regpage.jpeg';
    }
    return resolveUploadUrl(normalized, '/assets/img/regpage.jpeg');
  }

  getStoryVideoUrl(path: string): string {
    const normalized = this.normalizeMediaPath(path);
    if (!normalized) return '';
    if (/^(https?:|data:|blob:)/i.test(normalized)) return normalized;
    if (normalized.startsWith('videos/') || normalized.startsWith('uploads/')) {
      return `${environment.baseUrl}/${normalized}`;
    }
    return `${environment.baseUrl}/videos/${normalized}`;
  }

  getChefImage(profilePicture: string): string {
    const cleaned = profilePicture ? profilePicture.replace(/\\/g, '/') : '';
    if (!cleaned) return `/assets/img/regpage.jpeg`;
    if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) return cleaned;
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

  getCategoryImage(image?: string): string {
    const normalized = this.normalizeMediaPath(image);
    if (!normalized || this.brokenCategoryImages.has(normalized)) return '/assets/img/regpage.jpeg';
    return resolveUploadUrl(normalized, '/assets/img/regpage.jpeg');
  }

  onCategoryImageError(image?: string): void {
    const normalized = this.normalizeMediaPath(image);
    if (normalized) this.brokenCategoryImages.add(normalized);
  }

  onCategoryImageLoad(image?: string): void {
    const normalized = this.normalizeMediaPath(image);
    if (normalized) this.loadedCategoryImages.add(normalized);
  }

  getCategoryFetchPriority(index: number): 'high' | 'auto' {
    return index < 4 ? 'high' : 'auto';
  }

  isCategoryImageLoading(image?: string): boolean {
    const normalized = this.normalizeMediaPath(image);
    return !!normalized && !this.loadedCategoryImages.has(normalized) && !this.brokenCategoryImages.has(normalized);
  }

  onFoodImageError(image?: string): void {
    const normalized = this.normalizeMediaPath(image);
    if (normalized) this.brokenFoodImages.add(normalized);
  }

  onFoodImageLoad(image?: string): void {
    const normalized = this.normalizeMediaPath(image);
    if (normalized) this.loadedFoodImages.add(normalized);
  }

  isFoodImageLoading(image?: string): boolean {
    const normalized = this.normalizeMediaPath(image);
    return !!normalized && !this.loadedFoodImages.has(normalized) && !this.brokenFoodImages.has(normalized);
  }

  onStoryThumbError(group: StoryChefGroup): void {
    if (!group?.chefId) return;
    this.brokenStoryThumbChefs.add(String(group.chefId));
  }

  isStoryThumbBroken(group: StoryChefGroup): boolean {
    return this.brokenStoryThumbChefs.has(String(group?.chefId || ''));
  }

  onViewerStoryError(videoId: string): void {
    const id = String(videoId || '');
    if (id) this.brokenViewerStoryIds.add(id);
  }

  isViewerStoryBroken(videoId?: string): boolean {
    return this.brokenViewerStoryIds.has(String(videoId || ''));
  }

  private loadMissedStoriesCount(): void {
    if (!this.tokenStorage.getAccessToken() || !this.canUseFollowedFeed) {
      this.missedStoriesCount = 0;
      return;
    }
    const seenKey = `suga_story_seen_${this.currentUserId || 'guest'}`;
    const seen = new Set<string>((() => {
      try {
        const raw = localStorage.getItem(seenKey);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed.map((v) => String(v)) : [];
      } catch {
        return [];
      }
    })());
    this.http.get<any[]>(`${environment.apiUrl}/videos/followed`).subscribe({
      next: (items) => {
        const list = items || [];
        this.missedStoriesCount = list.filter((v) => !seen.has(String(v?._id || ''))).length;
      },
      error: () => {
        this.missedStoriesCount = 0;
      }
    });
  }

  private getSeenStoryIds(): Set<string> {
    return this.seenStoryIds;
  }

  private persistSeenStoryIds(ids: Set<string>): void {
    const seenKey = `suga_story_seen_${this.currentUserId || 'guest'}`;
    try {
      localStorage.setItem(seenKey, JSON.stringify(Array.from(ids)));
      localStorage.setItem('suga_story_last_seen', new Date().toISOString());
    } catch {}
  }

  private hydrateSeenStoryIds(): void {
    const seenKey = `suga_story_seen_${this.currentUserId || 'guest'}`;
    try {
      const raw = localStorage.getItem(seenKey);
      const parsed = raw ? JSON.parse(raw) : [];
      const ids = Array.isArray(parsed) ? parsed.map((v) => String(v)) : [];
      this.seenStoryIds = new Set(ids);
    } catch {
      this.seenStoryIds = new Set<string>();
    }
  }

  loadStoryGroups(): void {
    if (!this.tokenStorage.getAccessToken()) {
      this.storyGroups = [];
      return;
    }

    const sourceUrl = this.canUseFollowedFeed
      ? `${environment.apiUrl}/videos/followed`
      : `${environment.apiUrl}/videos`;

    this.http.get<StoryVideoItem[]>(sourceUrl).subscribe({
      next: (items) => {
        const videos = (items || []).filter((v) => !!v?._id && !!v?.userId);
        const seen = this.getSeenStoryIds();
        const chefMap = new Map<string, StoryChefGroup>();

        videos.forEach((video) => {
          const chefId = String(video.userId);
          if (!chefMap.has(chefId)) {
            const chef = this.chefs.find((c) => String(c._id) === chefId || c.username === video.username);
            chefMap.set(chefId, {
              chefId,
              username: video.username || chef?.username || 'chef',
              profilePicture: chef?.profilePicture || '',
              videos: [],
              unseenCount: 0,
              latestThumb: ''
            });
          }
          const group = chefMap.get(chefId)!;
          group.videos.push(video);
        });

        const groups = Array.from(chefMap.values()).map((group) => {
          group.videos = group.videos.sort((a, b) => {
            const aTime = new Date(a.uploadedAt || 0).getTime();
            const bTime = new Date(b.uploadedAt || 0).getTime();
            return aTime - bTime;
          });
          group.unseenCount = group.videos.filter((video) => !seen.has(String(video._id))).length;
          group.latestThumb = group.videos[group.videos.length - 1]?.path || '';
          return group;
        }).sort((a, b) => b.unseenCount - a.unseenCount);

        this.storyGroups = groups;
        this.preloadStoryThumbs(groups);
        this.missedStoriesCount = groups.reduce((sum, g) => sum + g.unseenCount, 0);
      },
      error: () => {
        this.storyGroups = [];
      }
    });
  }

  openStoryViewer(group: StoryChefGroup): void {
    if (!group?.videos?.length) return;
    this.activeStoryGroup = group;
    const seen = this.getSeenStoryIds();
    const firstUnseenIdx = group.videos.findIndex((v) => !seen.has(String(v._id)));
    this.activeStoryIndex = firstUnseenIdx >= 0 ? firstUnseenIdx : Math.max(0, group.videos.length - 1);
    this.activeStoryProgress = 0;
    this.activeStoryPaused = false;
    this.showStoryViewer = true;
    this.markStorySeen(this.currentStory?._id || '');
  }

  private preloadCategoryImages(): void {
    this.categories.slice(0, 6).forEach((category) => this.preloadImage(this.getCategoryImage(category.image)));
  }

  private preloadStoryThumbs(groups: StoryChefGroup[]): void {
    groups.slice(0, 4).forEach((group) => {
      const url = this.getStoryVideoUrl(group.latestThumb);
      if (!url) return;
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.src = url;
    });
  }

  private preloadImage(url: string): void {
    if (!url) return;
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
  }

  closeStoryViewer(): void {
    this.showStoryViewer = false;
    this.activeStoryGroup = null;
    this.activeStoryIndex = 0;
    this.activeStoryProgress = 0;
    this.activeStoryPaused = false;
  }

  get currentStory(): StoryVideoItem | null {
    if (!this.activeStoryGroup) return null;
    return this.activeStoryGroup.videos[this.activeStoryIndex] || null;
  }

  nextStory(): void {
    if (!this.activeStoryGroup) return;
    if (this.activeStoryIndex < this.activeStoryGroup.videos.length - 1) {
      this.activeStoryIndex += 1;
      this.activeStoryProgress = 0;
      this.activeStoryPaused = false;
      this.markStorySeen(this.currentStory?._id || '');
      return;
    }
    this.closeStoryViewer();
  }

  prevStory(): void {
    if (!this.activeStoryGroup) return;
    if (this.activeStoryIndex > 0) {
      this.activeStoryIndex -= 1;
      this.activeStoryProgress = 0;
      this.activeStoryPaused = false;
      this.markStorySeen(this.currentStory?._id || '');
    }
  }

  toggleViewerPlayback(video: HTMLVideoElement): void {
    if (video.paused) {
      video.play();
      this.activeStoryPaused = false;
      this.showViewerPlaybackHint('play');
    } else {
      video.pause();
      this.activeStoryPaused = true;
      this.showViewerPlaybackHint('pause');
    }
  }

  onViewerTimeUpdate(video: HTMLVideoElement): void {
    const duration = Number(video.duration || 0);
    const currentTime = Number(video.currentTime || 0);
    if (!duration || duration <= 0) {
      this.activeStoryProgress = 0;
      return;
    }
    this.activeStoryProgress = Math.max(0, Math.min(100, (currentTime / duration) * 100));
  }

  onViewerLoadedMetadata(video: HTMLVideoElement): void {
    this.activeStoryProgress = 0;
    if (!this.activeStoryPaused) {
      video.play().catch(() => {});
    }
  }

  private normalizeMediaPath(value?: string): string {
    return String(value || '')
      .trim()
      .replace(/\\/g, '/')
      .replace(/^\.\//, '')
      .replace(/^\/+/, '');
  }

  private showViewerPlaybackHint(state: 'play' | 'pause'): void {
    this.viewerPlaybackHint = state;
    if (this.viewerHintTimer) clearTimeout(this.viewerHintTimer);
    this.viewerHintTimer = setTimeout(() => {
      this.viewerPlaybackHint = '';
    }, 700);
  }

  onViewerTouchStart(event: TouchEvent): void {
    this.touchStartX = event.changedTouches[0]?.clientX || 0;
  }

  onViewerTouchEnd(event: TouchEvent): void {
    this.touchEndX = event.changedTouches[0]?.clientX || 0;
    const delta = this.touchEndX - this.touchStartX;
    if (Math.abs(delta) < 40) return;
    if (delta < 0) this.nextStory();
    if (delta > 0) this.prevStory();
  }

  markStorySeen(videoId: string): void {
    const id = String(videoId || '');
    if (!id) return;
    const seen = this.seenStoryIds;
    if (seen.has(id)) return;
    seen.add(id);
    this.persistSeenStoryIds(seen);
    this.storyGroups = this.storyGroups.map((group) => {
      const unseenCount = group.videos.filter((v) => !seen.has(String(v._id))).length;
      return { ...group, unseenCount };
    });
    this.missedStoriesCount = this.storyGroups.reduce((sum, group) => sum + group.unseenCount, 0);
  }

  isStorySegmentWatched(videoId: string): boolean {
    return this.seenStoryIds.has(String(videoId || ''));
  }

  getStorySegmentProgress(index: number, videoId: string): number {
    if (index < this.activeStoryIndex) return 100;
    if (index === this.activeStoryIndex) return this.activeStoryProgress;
    if (this.isStorySegmentWatched(videoId)) return 100;
    return 0;
  }
}
