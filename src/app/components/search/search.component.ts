import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SearchService, SearchResults } from 'src/app/services/search.service';
import { ModalController } from '@ionic/angular';
import { FoodProfileComponent } from '../food-profile/food-profile.component';
import { ProfileModalComponent } from '../profile-modal/profile-modal.component';
import { TokenStorageService } from 'src/app/services/token-storage.service';
import { UserService } from 'src/app/services/user.service';
import { resolveUploadUrl } from 'src/app/utils/media-url';

interface QuickLink {
  label: string;
  route: string;
  keywords: string[];
}

@Component({
  selector: 'app-search',
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.scss']
})
export class SearchComponent implements OnInit {
  query = '';
  loading = false;
  results: SearchResults | null = null;
  chefs: Array<{ _id: string; username: string; profilePicture: string; dishCount: number; followersCount: number; score: number }> = [];
  chefsLoading = false;
  chefsError = '';

  quickLinks: QuickLink[] = [
    { label: 'Explore', route: '/components/explore', keywords: ['explore', 'home', 'foods'] },
    { label: 'Chefs', route: '/components/chefs', keywords: ['chef', 'chefs', 'kitchen', 'follow'] },
    { label: 'Food Story', route: '/components/story', keywords: ['story', 'video', 'posts'] },
    { label: 'Notifications', route: '/components/notifications', keywords: ['notification', 'alert'] },
    { label: 'My Account', route: '/components/account', keywords: ['account', 'profile', 'me', 'dashboard'] },
    { label: 'Chef Dashboard', route: '/components/chef', keywords: ['chef', 'dashboard'] }
  ];

  constructor(
    private searchService: SearchService,
    private router: Router,
    private route: ActivatedRoute,
    private modalController: ModalController,
    private tokenStorage: TokenStorageService,
    private userService: UserService
  ) {}

  ngOnInit(): void {
    this.loadChefs();
    const q = this.route.snapshot.queryParamMap.get('q');
    if (q) {
      this.query = q;
      this.search();
    }
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

  goTo(route: string): void {
    if (route === '/components/account') {
      this.router.navigate([this.getDashboardRoute()]);
      return;
    }
    this.router.navigate([route]);
  }

  get visibleChefs(): Array<{ _id: string; username: string; profilePicture: string; dishCount: number; followersCount: number; score: number }> {
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

  openChefDirectory(): void {
    this.router.navigate(['/components/chefs']);
  }

  openVideo(videoId: string): void {
    if (!videoId) return;
    this.router.navigate(['/components/story'], { queryParams: { videoId } });
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

  private loadChefs(): void {
    this.chefsLoading = true;
    this.chefsError = '';
    this.userService.getChefSummaries().subscribe({
      next: (chefs) => {
        this.chefs = Array.isArray(chefs) ? chefs : [];
        this.chefsLoading = false;
      },
      error: () => {
        this.chefs = [];
        this.chefsLoading = false;
        this.chefsError = 'Chef list unavailable.';
      }
    });
  }
}
