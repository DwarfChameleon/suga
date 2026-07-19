import { Component, OnDestroy, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { LoginModalComponent } from 'src/app/login-modal/login-modal.component';
import { FollowChangeEvent, UserService } from 'src/app/services/user.service';
import { TokenStorageService } from 'src/app/services/token-storage.service';
import { UiFeedbackService } from 'src/app/services/ui-feedback.service';
import { resolveUploadUrl } from 'src/app/utils/media-url';
import { ProfileModalComponent } from '../profile-modal/profile-modal.component';

interface ChefDirectoryItem {
  _id: string;
  username: string;
  profilePicture: string;
  dishCount: number;
  followersCount: number;
  score?: number;
}

@Component({
  selector: 'app-chef-directory',
  templateUrl: './chef-directory.component.html',
  styleUrls: ['./chef-directory.component.scss']
})
export class ChefDirectoryComponent implements OnInit, OnDestroy {
  chefs: ChefDirectoryItem[] = [];
  followedChefIds = new Set<string>();
  query = '';
  loading = false;
  errorMessage = '';
  canFollowChefs = false;
  private followSub?: Subscription;

  constructor(
    private userService: UserService,
    private tokenStorage: TokenStorageService,
    private modalController: ModalController,
    private uiFeedback: UiFeedbackService
  ) {}

  ngOnInit(): void {
    this.refreshAuthState();
    this.followSub = this.userService.followChanged$.subscribe((change) => {
      if (change?.chefId) this.applyFollowChange(change);
    });
    this.loadFollowedChefs();
    this.loadChefs();
  }

  ngOnDestroy(): void {
    this.followSub?.unsubscribe();
  }

  refresh(): void {
    this.loadFollowedChefs();
    this.loadChefs();
  }

  get filteredChefs(): ChefDirectoryItem[] {
    const term = this.query.trim().toLowerCase();
    const list = [...this.chefs].sort((a, b) => {
      const scoreDiff = Number(b.score || 0) - Number(a.score || 0);
      if (scoreDiff !== 0) return scoreDiff;
      return String(a.username || '').localeCompare(String(b.username || ''));
    });
    if (!term) return list;
    return list.filter((chef) => String(chef.username || '').toLowerCase().includes(term));
  }

  getChefImage(profilePicture: string): string {
    return resolveUploadUrl(profilePicture, '/assets/img/regpage.jpeg');
  }

  isFollowing(chefId: string): boolean {
    return this.followedChefIds.has(String(chefId || ''));
  }

  async openChefProfile(username: string): Promise<void> {
    if (!username) return;
    const modal = await this.modalController.create({
      component: ProfileModalComponent,
      componentProps: { username },
      cssClass: 'suga-profile-sheet',
      handle: true,
      initialBreakpoint: 0.82,
      breakpoints: [0, 0.58, 0.82, 0.96]
    });
    await modal.present();
  }

  async toggleFollow(chef: ChefDirectoryItem, event?: Event): Promise<void> {
    event?.stopPropagation();
    const chefId = String(chef?._id || '');
    if (!chefId || !this.canFollowChefs) return;

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
      error: (error) => {
        this.uiFeedback.error(error?.error?.message || 'Unable to update follow status.');
      }
    });
  }

  private refreshAuthState(): void {
    const roles = (this.tokenStorage.getRoles() || []).map((role) => String(role || '').toLowerCase());
    this.canFollowChefs = roles.includes('consumer') || roles.includes('dispatch') || roles.includes('chef');
  }

  private loadFollowedChefs(): void {
    if (!this.tokenStorage.getAccessToken()) {
      this.followedChefIds.clear();
      this.refreshAuthState();
      return;
    }
    this.userService.getFollowingChefIds().subscribe({
      next: (data) => {
        this.followedChefIds = new Set((data.followingChefs || []).map((id) => String(id)));
        this.refreshAuthState();
      },
      error: () => {
        this.followedChefIds.clear();
        this.refreshAuthState();
      }
    });
  }

  private loadChefs(): void {
    this.loading = true;
    this.errorMessage = '';
    this.userService.getChefSummaries().subscribe({
      next: (data) => {
        this.chefs = Array.isArray(data) ? data : [];
        this.loading = false;
      },
      error: () => {
        this.chefs = [];
        this.loading = false;
        this.errorMessage = 'Unable to load chefs right now.';
      }
    });
  }

  private applyFollowChange(change: FollowChangeEvent): void {
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
      String(chef._id) === chefId
        ? {
            ...chef,
            followersCount: Number.isFinite(Number(change.followersCount))
              ? Number(change.followersCount)
              : Math.max(0, Number(chef.followersCount || 0) + (change.following ? 1 : -1))
          }
        : chef
    );
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
}
