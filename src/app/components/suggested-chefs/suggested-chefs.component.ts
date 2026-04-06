import { Component, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { UserService } from 'src/app/services/user.service';
import { UiFeedbackService } from 'src/app/services/ui-feedback.service';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-suggested-chefs',
  templateUrl: './suggested-chefs.component.html',
  styleUrls: ['./suggested-chefs.component.scss']
})
export class SuggestedChefsComponent implements OnInit {
  chefs: Array<{ _id: string; username: string; profilePicture: string; dishCount: number; followersCount: number }> = [];
  dontShowAgain = false;
  followedChefIds = new Set<string>();

  constructor(
    private modalController: ModalController,
    private userService: UserService,
    private uiFeedback: UiFeedbackService
  ) {}

  ngOnInit(): void {
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
      },
      (error) => {
        this.uiFeedback.error(error?.error?.message || 'Unable to update follow.');
      }
    );
  }

  isFollowing(chefId: string): boolean {
    return this.followedChefIds.has(chefId);
  }
}
