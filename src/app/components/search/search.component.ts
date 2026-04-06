import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SearchService, SearchResults } from 'src/app/services/search.service';
import { ModalController } from '@ionic/angular';
import { FoodProfileComponent } from '../food-profile/food-profile.component';
import { ProfileModalComponent } from '../profile-modal/profile-modal.component';
import { TokenStorageService } from 'src/app/services/token-storage.service';

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

  quickLinks: QuickLink[] = [
    { label: 'Explore', route: '/components/explore', keywords: ['explore', 'home', 'foods'] },
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
    private tokenStorage: TokenStorageService
  ) {}

  ngOnInit(): void {
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
}
