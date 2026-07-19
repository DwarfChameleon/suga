import { Component, OnDestroy, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { FollowChangeEvent, UserService } from 'src/app/services/user.service';
import { UiFeedbackService } from 'src/app/services/ui-feedback.service';
import { environment } from 'src/environments/environment';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-suggested-chefs',
  templateUrl: './suggested-chefs.component.html',
  styleUrls: ['./suggested-chefs.component.scss']
})
export class SuggestedChefsComponent implements OnInit, OnDestroy {
  chefs: Array<{ _id: string; username: string; profilePicture: string; dishCount: number; followersCount: number }> = [];
  dontShowAgain = false;
  followedChefIds = new Set<string>();
  private followSub?: Subscription;

  constructor(
    private modalController: ModalController,
    private userService: UserService,
    private uiFeedback: UiFeedbackService
  ) {}

  ngOnInit(): void {
    this.followSub = this.userService.followChanged$.subscribe((change) => {
      if (change?.chefId) {
        this.applyFollowChange(change);
      }
    });
    this.userService.getFollowingChefIds().subscribe(
      data => {
        this.followedChefIds = new Set(data.followingChefs || []);
        this.loadChefs();
      },
      error => {
        console.error('Error loading follow list:', error);
        this.loadChefs();
      }
    );
  }

  ngOnDestroy(): void {
    this.followSub?.unsubscribe();
  }

  private loadChefs(): void {
    this.userService.getChefSummaries().subscribe(
      data => {
        this.chefs = data.filter(c => !this.followedChefIds.has(c._id));
      },
      error => {
        console.error('Error loading suggested chefs:', error);
      }
    );
  }

  close(): void {
    if (this.dontShowAgain) {
      localStorage.setItem('suga-hide-suggested-chefs', 'true');
    }
    this.modalController.dismiss();
  }

  getChefImage(profilePicture: string): string {
    const cleaned = profilePicture ? profilePicture.replace(/\\/g, '/') : '';
    if (!cleaned) return '/assets/img/regpage.jpeg';
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

  toggleDontShow(ev: any): void {
    this.dontShowAgain = !!ev.detail?.checked;
  }

  toggleFollow(chefId: string): void {
    this.userService.toggleFollowChef(chefId).subscribe(
      (res) => {
        if (res.pending) {
          this.uiFeedback.success('Follow request sent.');
          return;
        }
        if (res.following) {
          this.followedChefIds.add(chefId);
        } else {
          this.followedChefIds.delete(chefId);
        }
        this.applyFollowChange({ chefId, ...res });
      },
      (error) => {
        this.uiFeedback.error(error?.error?.message || 'Unable to update follow.');
      }
    );
  }

  isFollowing(chefId: string): boolean {
    return this.followedChefIds.has(chefId);
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
}
