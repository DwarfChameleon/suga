import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SearchService, SearchResults } from 'src/app/services/search.service';
import { ModalController } from '@ionic/angular';
import { FoodProfileComponent } from '../food-profile/food-profile.component';
import { ProfileModalComponent } from '../profile-modal/profile-modal.component';
import { TokenStorageService } from 'src/app/services/token-storage.service';
import { UserService } from 'src/app/services/user.service';
import { resolveUploadUrl } from 'src/app/utils/media-url';
import { StoryComponent } from '../story/story.component';
import { Subscription } from 'rxjs';
import { UiFeedbackService } from 'src/app/services/ui-feedback.service';
import { LoginModalComponent } from 'src/app/login-modal/login-modal.component';
import { FoodService, FoodCategory } from 'src/app/services/food.service';
import { Food } from 'src/app/interface/food';

interface QuickLink {
  label: string;
  icon: string;
  color: string;
  route: string;
  keywords: string[];
}

interface CategoryLink {
  name: string;
  icon: string;
  slug: string;
  color: string;
}

interface ChefSearchItem {
  _id: string;
  username: string;
  profilePicture: string;
  dishCount: number;
  followersCount: number;
  score: number;
  isVerified?: boolean;
}

@Component({
  selector: 'app-search',
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.scss']
})
export class SearchComponent implements OnInit, OnDestroy {
  query = '';
  loading = false;
  results: SearchResults | null = null;
  chefs: ChefSearchItem[] = [];
  chefsLoading = false;
  chefsError = '';
  selectedCategory = 'all';
  followedChefIds = new Set<string>();
  private followSub?: Subscription;

  quickLinks: QuickLink[] = [
    { label: 'Explore', icon: 'compass-outline', color: 'pink', route: '/components/explore', keywords: ['explore', 'home', 'foods'] },
    { label: 'Chefs', icon: 'restaurant-outline', color: 'orange', route: '/components/chefs', keywords: ['chef', 'chefs', 'kitchen', 'follow'] },
    { label: 'Food Story', icon: 'film-outline', color: 'purple', route: '/components/story', keywords: ['story', 'video', 'posts'] },
    { label: 'Notifications', icon: 'notifications-outline', color: 'yellow', route: '/components/notifications', keywords: ['notification', 'alert'] },
    { label: 'My Account', icon: 'person-outline', color: 'green', route: '/components/account', keywords: ['account', 'profile', 'me', 'dashboard'] }
  ];

  categories: CategoryLink[] = [];

  constructor(
    private searchService: SearchService,
    private router: Router,
    private route: ActivatedRoute,
    private modalController: ModalController,
    private tokenStorage: TokenStorageService,
    private userService: UserService,
    private uiFeedback: UiFeedbackService,
    private foodService: FoodService
  ) {}

  ngOnInit(): void {
    this.loadChefs();
    this.loadCategories();
    this.loadFollowedChefs();
    this.followSub = this.userService.followChanged$.subscribe((change) => {
      if (change) this.applyFollowChange(change);
    });
    const q = this.route.snapshot.queryParamMap.get('q');
    if (q) {
      this.query = q;
      this.search();
    }
  }

  ngOnDestroy(): void {
    this.followSub?.unsubscribe();
  }

  search(): void {
    const q = this.query.trim();
    if (!q) {
      this.results = null;
      return;
    }
    this.loading = true;
    this.searchService.search(q).subscribe({
      next: (data) => {
        this.results = data;
        this.loading = false;
      },
      error: () => {
        this.results = { foods: [], videos: [], users: [] };
        this.loading = false;
      }
    });
  }

  async goTo(route: string): Promise<void> {
    if (route === '/components/account') {
      this.router.navigate([this.getDashboardRoute()]);
      return;
    }
    if (route === '/components/story') {
      await this.openStoryModal();
      return;
    }
    this.router.navigate([route]);
  }

  get visibleChefs(): ChefSearchItem[] {
    const q = this.query.trim().toLowerCase();
    const sorted = [...this.chefs].sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
    if (!q) return sorted.slice(0, 8);
    return sorted.filter((chef) => String(chef.username || '').toLowerCase().includes(q)).slice(0, 8);
  }

  getChefImage(profilePicture: string): string {
    return resolveUploadUrl(profilePicture, '/assets/img/regpage.jpeg');
  }

  filteredQuickLinks(): QuickLink[] {
    const q = this.query.trim().toLowerCase();
    if (!q) return this.quickLinks;
    return this.quickLinks.filter(link => link.keywords.some(k => k.includes(q)));
  }

  selectCategory(category: CategoryLink): void {
    this.selectedCategory = category.slug;
    if (category.slug === 'all') {
      this.query = '';
      this.results = null;
      return;
    }
    this.query = category.name;
    this.search();
  }

  getCategoryIcon(category: CategoryLink): string {
    const name = String(category?.name || '').toLowerCase();
    if (name.includes('drink') || name.includes('juice') || name.includes('tea') || name.includes('coffee')) return 'cafe-outline';
    if (name.includes('snack') || name.includes('small')) return 'nutrition-outline';
    if (name.includes('dessert') || name.includes('cake') || name.includes('sweet')) return 'ice-cream-outline';
    if (name.includes('healthy') || name.includes('vegan') || name.includes('salad')) return 'leaf-outline';
    if (name.includes('rice') || name.includes('jollof') || name.includes('pasta') || name.includes('main')) return 'fast-food-outline';
    return 'restaurant-outline';
  }

  startVoiceSearch(): void {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      this.uiFeedback.error('Voice search is not available on this device.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-NG';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event: any) => {
      this.query = event.results?.[0]?.[0]?.transcript || '';
      this.search();
    };
    recognition.onerror = () => this.uiFeedback.error('Voice search could not start.');
    recognition.start();
  }

  openTag(tag: string): void {
    this.query = `#${tag}`;
    this.search();
  }

  openMention(username: string): void {
    this.query = `@${username}`;
    this.search();
  }

  async openFood(foodId: string): Promise<void> {
    if (!foodId) return;
    const modal = await this.modalController.create({
      component: FoodProfileComponent,
      componentProps: { foodId }
    });
    await modal.present();
  }

  async openUser(username: string): Promise<void> {
    if (!username) return;
    const modal = await this.modalController.create({
      component: ProfileModalComponent,
      componentProps: { username }
    });
    await modal.present();
  }

  async openChef(chef: ChefSearchItem): Promise<void> {
    await this.openUser(chef.username);
  }

  openChefDirectory(): void {
    this.router.navigate(['/components/chefs']);
  }

  viewAllChefs(): void {
    this.openChefDirectory();
  }

  isFollowing(chefId: string): boolean {
    return this.followedChefIds.has(String(chefId || ''));
  }

  async toggleFollow(chef: ChefSearchItem, event?: Event): Promise<void> {
    event?.stopPropagation();
    const chefId = String(chef?._id || '');
    if (!chefId) return;
    if (!this.tokenStorage.getAccessToken()) {
      this.uiFeedback.error('Please login to follow chefs.');
      await this.openLoginModal();
      return;
    }
    this.userService.toggleFollowChef(chefId).subscribe({
      next: (res) => {
        if (res.pending) {
          this.uiFeedback.success('Follow request sent. Awaiting approval.');
          return;
        }
        this.applyFollowChange({ chefId, ...res });
      },
      error: (error) => this.uiFeedback.error(error?.error?.message || 'Unable to update follow status.')
    });
  }

  formatFollowers(count: number): string {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1).replace('.0', '')}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1).replace('.0', '')}K`;
    return String(count || 0);
  }

  editQuickLinks(): void {
    this.uiFeedback.success('Quick link editing will be available soon.');
  }

  goHome(): void {
    this.router.navigate(['/components/explore']);
  }

  goExplore(): void {
    this.router.navigate(['/components/explore']);
  }

  async goCreate(): Promise<void> {
    await this.openStoryModal();
  }

  goOrders(): void {
    this.router.navigate(['/components/order-history']);
  }

  goProfile(): void {
    this.router.navigate([this.getDashboardRoute()]);
  }

  async openVideo(videoId: string): Promise<void> {
    if (!videoId) return;
    await this.openStoryModal(videoId);
  }

  goBack(): void {
    this.router.navigate(['/components/explore']);
  }

  private getDashboardRoute(): string {
    const roles = (this.tokenStorage.getRoles() || []).map((role) => String(role || '').toLowerCase());
    if (roles.includes('chef')) return '/components/chef';
    if (roles.includes('dispatch')) return '/components/dispatch';
    if (roles.includes('consumer')) return '/components/consumer';
    return '/components/explore';
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
    await modal.present();
  }

  private async openLoginModal(): Promise<void> {
    const modal = await this.modalController.create({
      component: LoginModalComponent,
      cssClass: 'login-modal-class',
      handle: true,
      initialBreakpoint: 1,
      breakpoints: [0, 0.92, 1],
      backdropDismiss: false
    });
    await modal.present();
  }

  private loadFollowedChefs(): void {
    if (!this.tokenStorage.getAccessToken()) {
      this.followedChefIds.clear();
      return;
    }
    this.userService.getFollowingChefIds().subscribe({
      next: (data) => {
        this.followedChefIds = new Set((data.followingChefs || []).map((id) => String(id)));
      },
      error: () => {
        this.followedChefIds.clear();
      }
    });
  }

  private loadChefs(): void {
    this.chefsLoading = true;
    this.chefsError = '';
    this.userService.getChefSummaries().subscribe({
      next: (chefs) => {
        this.chefs = Array.isArray(chefs) ? chefs as ChefSearchItem[] : [];
        this.chefsLoading = false;
      },
      error: () => {
        this.chefs = [];
        this.chefsLoading = false;
        this.chefsError = 'Chef list unavailable.';
      }
    });
  }

  private loadCategories(): void {
    this.foodService.getCategoryList().subscribe({
      next: (list) => {
        const categoryList = (list || [])
          .map((item: FoodCategory | string) =>
            typeof item === 'string'
              ? { name: item, image: '', images: [] }
              : { name: item?.name || '', image: item?.image || '', images: Array.isArray(item?.images) ? item.images : [] }
          )
          .filter((item: FoodCategory) => !!item.name);

        this.foodService.getAllFoods().subscribe({
          next: (foods) => this.setCategoriesFromFoods(categoryList, foods || []),
          error: () => this.setCategoriesFromFoods(categoryList, [])
        });
      },
      error: () => {
        this.foodService.getAllFoods().subscribe({
          next: (foods) => this.setCategoriesFromFoods([], foods || []),
          error: () => this.categories = []
        });
      }
    });
  }

  private setCategoriesFromFoods(categoryList: FoodCategory[], foods: Food[]): void {
    const available = new Set(
      (foods || [])
        .map((food) => String((food as any)?.category || '').trim())
        .filter(Boolean)
        .map((category) => category.toLowerCase())
    );
    const configured = (categoryList || []).filter((category) =>
      available.has(String(category?.name || '').trim().toLowerCase())
    );
    const fallbackMap = new Map<string, string>();
    (foods || []).forEach((food) => {
      const name = String((food as any)?.category || '').trim();
      if (name) fallbackMap.set(name.toLowerCase(), name);
    });
    const fallback = Array.from(fallbackMap.values()).map((name) => ({ name }));
    const source = configured.length ? configured : fallback;
    this.categories = [
      { name: 'All', icon: 'restaurant-outline', slug: 'all', color: 'pink' },
      ...source.map((category, index) => ({
        name: category.name,
        icon: this.getCategoryIcon({ name: category.name, icon: '', slug: '', color: '' }),
        slug: this.slugify(category.name),
        color: this.getCategoryColor(index)
      }))
    ];
  }

  private getCategoryColor(index: number): string {
    return ['pink', 'orange', 'green', 'purple', 'yellow', 'blue'][index % 6];
  }

  private slugify(value: string): string {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private applyFollowChange(change: any): void {
    const chefId = String(change?.chefId || '');
    if (!chefId) return;
    if (change.following) {
      this.followedChefIds.add(chefId);
    } else {
      this.followedChefIds.delete(chefId);
    }
    if (Array.isArray(change.followingChefs)) {
      this.followedChefIds = new Set(change.followingChefs.map((id: string) => String(id)));
    }
    this.chefs = this.chefs.map((chef) =>
      chef._id === chefId
        ? {
            ...chef,
            followersCount: Number.isFinite(Number(change.followersCount))
              ? Number(change.followersCount)
              : Math.max(0, Number(chef.followersCount || 0) + (change.following ? 1 : -1))
          }
        : chef
    );
  }
}
