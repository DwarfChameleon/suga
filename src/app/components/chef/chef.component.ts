import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Food } from 'src/app/interface/food';
import { FoodService } from 'src/app/services/food.service';
import { TokenStorageService } from 'src/app/services/token-storage.service';
import { UserInfo } from 'src/app/interface/user-details';
import { ActivatedRoute, Router } from '@angular/router';
import { FoodProfileComponent } from '../food-profile/food-profile.component';
import { UserService } from 'src/app/services/user.service';
import { ChefDashboardService } from 'src/app/services/chefdashboard.service';
import { Order } from 'src/app/interface/order';
import { OrderService } from 'src/app/services/order.service';
import { OrderInfoComponent } from '../order-info/order-info.component';
import { ActionSheetController, AlertController, ModalController, AlertInput } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { environment } from 'src/environments/environment';
import { NetworkService } from 'src/app/services/network.service';
import { UiFeedbackService } from 'src/app/services/ui-feedback.service';
import { ProfileModalComponent } from '../profile-modal/profile-modal.component';
import { OrderRatingComponent } from '../order-rating/order-rating.component';

@Component({
  selector: 'app-chef',
  templateUrl: './chef.component.html',
  styleUrls: ['./chef.component.scss'],
})
export class ChefComponent implements OnInit, OnDestroy {

  userProfile: UserInfo | undefined;
  profileDetails: any = null;
  chefFoods: Food[] = [];
  foods: Food[] = [];
  orders: Order[] = [];
  liveOrders: Order[] = [];
  videos: any[] = [];
  selectedVideo: any | null = null;
  isVideoModalOpen = false;
  followers: any[] = [];
  selectedTab = 'orders';
  isLoadingOrders = false;
  isLoadingDishes = false;
  isLoadingVideos = false;
  isLoadingFollowers = false;
  isOnline = true;
  tokenStorageService: any;
  errorMessage: string | undefined;
  promptMessage: string | undefined;
  showImageSheet = false;
  imageTarget: 'profile' | 'cover' = 'profile';
  captureMode: string | null = null;
  isStoryLaunching = false;
  followedChefIds = new Set<string>();
  private storyLaunchTimer?: ReturnType<typeof setTimeout>;
  private promptedRatingIds = new Set<string>();
  private ratingsInitialized = false;
  private completedSeen = new Set<string>();
  private locationCaptured = false;
  @ViewChild('imageInput') imageInput?: ElementRef<HTMLInputElement>;
  
  constructor(
    private foodService: FoodService,
    private orderService: OrderService,
    private tokenStorage: TokenStorageService,
    private router: Router,
    private route: ActivatedRoute,
    private modalController: ModalController,
    private actionSheetController: ActionSheetController,
    private alertController: AlertController,
    private userService: UserService,
    private chefDashboardService: ChefDashboardService,
    private networkService: NetworkService,
    private uiFeedback: UiFeedbackService

  ) {}

  ngOnInit(): void {
    const tab = this.route.snapshot.queryParamMap.get('tab');
    if (tab) {
      this.selectedTab = tab;
    }
    this.loadUserProfile();
    this.loadProfileDetails();
    this.loadOrders();
    this.captureLocation();
    this.networkService.online$.subscribe((online) => {
      this.isOnline = online;
    });
  }

  refresh(event: any): void {
    this.loadUserProfile();
    this.loadProfileDetails();
    this.loadOrders();
    this.captureLocation();
    const refresher = event?.target as HTMLIonRefresherElement | null;
    setTimeout(() => refresher?.complete(), 700);
  }

  private captureLocation(): void {
    if (this.locationCaptured || !navigator.geolocation) return;
    this.locationCaptured = true;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.userService.updateLocation(pos.coords.latitude, pos.coords.longitude).subscribe({
          next: () => {},
          error: () => {}
        });
      },
      () => {
        this.locationCaptured = false;
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  }
  ///chef order pane
  fetchChefOrders(): void {
    this.isLoadingOrders = true;
    this.chefDashboardService.getChefOrders().subscribe(
      (orders) => {
        if (orders.length === 0) {
          this.orders = [];
          this.liveOrders = [];
          this.errorMessage = 'You have not received any orders!';
        } else {
          this.orders = this.sortOrdersByRecent(orders);
          this.liveOrders = this.orders.filter((order) => this.isLiveStatus(order.status));
          this.errorMessage = undefined;
        }
        this.isLoadingOrders = false;
      },
      (error) => {
        console.error('Error fetching chef orders:', error);
        this.errorMessage = 'Order unavailable';
        this.isLoadingOrders = false;
      }
    );
  }
  

  loadOrders() {
    this.isLoadingOrders = true;
    this.chefDashboardService.getChefOrders().subscribe(
      (orders: Order[]) => {
        this.orders = this.sortOrdersByRecent(orders);
        this.liveOrders = this.orders.filter((order) => this.isLiveStatus(order.status));
        this.promptRatingIfNeeded();
        this.isLoadingOrders = false;
      },
      (error) => {
        console.error('Error fetching chef orders:', error);
        this.uiFeedback.error('Unable to load orders at the moment.');
        this.isLoadingOrders = false;
      }
    );
  }
  

  updateOrderStatus(order: Order, status: string) {
    if (!order._id) {
      console.error('Order ID is undefined');
      return;
    }
  
    this.chefDashboardService.updateOrderStatus(order._id, status).subscribe(
      (_updatedOrder: Order) => {
        this.loadOrders();
        this.uiFeedback.success(`Order marked ${status}.`);
      },
      (error) => {
        console.error('Error updating order status:', error);
        this.uiFeedback.error(error?.error?.error || 'Could not update order status.');
      }
    );
  }

  async openStatusSheet(order: Order): Promise<void> {
    if (!order?._id) return;
    const sheet = await this.actionSheetController.create({
      header: 'Update Order Status',
      buttons: [
        {
          text: 'Processing',
          handler: () => this.updateOrderStatus(order, 'processing')
        },
        {
          text: 'Sent for delivery',
          handler: () => this.openDispatchSelection(order)
        },
        {
          text: 'Cancel',
          role: 'cancel'
        }
      ]
    });
    await sheet.present();
  }

  private async openDispatchSelection(order: Order): Promise<void> {
    try {
      const res = await firstValueFrom(this.orderService.getAvailableDispatchRiders(order._id));
      const riders = Array.isArray(res?.riders) ? res.riders : [];
      if (!riders.length) {
        this.uiFeedback.error('No dispatch riders are registered and available yet.');
        return;
      }
      const inputs: AlertInput[] = [
        {
          name: 'dispatchRider',
          type: 'radio' as const,
          label: 'Auto-assign nearest',
          value: '__auto__',
          checked: true
        },
        ...riders.map((r) => ({
          name: 'dispatchRider',
          type: 'radio' as const,
          label: `${r.username}${r.distanceKm !== null ? ` (${r.distanceKm.toFixed(1)} km)` : ''}`,
          value: r._id
        }))
      ];

      const alert = await this.alertController.create({
        header: 'Choose Dispatch Rider',
        inputs,
        buttons: [
          { text: 'Cancel', role: 'cancel' },
          {
            text: 'Assign',
            handler: (value) => {
              const autoAssign = value === '__auto__';
              this.chefDashboardService
                .updateOrderStatus(order._id, 'processing', {
                  dispatchAssign: true,
                  autoAssign,
                  dispatchRiderId: autoAssign ? undefined : value
                })
                .subscribe({
                  next: () => {
                    this.uiFeedback.success('Dispatch assigned.');
                    this.loadOrders();
                  },
                  error: (error) => {
                    this.uiFeedback.error(error?.error?.error || 'Could not assign dispatch rider.');
                  }
                });
            }
          }
        ]
      });
      await alert.present();
    } catch (error: any) {
      this.uiFeedback.error(error?.error?.message || 'Unable to load dispatch riders.');
    }
  }

  private isLiveStatus(status: Order['status']): boolean {
    return ['placed', 'confirmed', 'processing', 'delivered', 'approved'].includes(status);
  }

  getChefStatusLabel(order: Order): string {
    const status = order?.status;
    if (status === 'placed') return 'Pending your approval';
    if (status === 'confirmed') return 'Accepted';
    if (status === 'declined') return 'Declined';
    if (status === 'processing') return 'Processing';
    if (status === 'delivered') return 'Delivered';
    if (status === 'completed') return 'Completed';
    if (status === 'cancelled') return 'Cancelled by system';
    return status ? String(status).replace(/_/g, ' ') : 'Pending';
  }

  private sortOrdersByRecent(orders: Order[]): Order[] {
    return [...orders].sort((a, b) => {
      const aTime = a.orderTime ? new Date(a.orderTime).getTime() : 0;
      const bTime = b.orderTime ? new Date(b.orderTime).getTime() : 0;
      return bTime - aTime;
    });
  }

  private async promptRatingIfNeeded(): Promise<void> {
    const completedOrders = this.orders.filter((order) => order.status === 'completed');
    if (!this.ratingsInitialized) {
      completedOrders.forEach((o) => o._id && this.completedSeen.add(o._id));
      this.ratingsInitialized = true;
      return;
    }

    const newlyCompleted = completedOrders.find(
      (order) => !!order._id && !this.completedSeen.has(order._id) && !this.hasRated(order)
    );
    if (!newlyCompleted?._id || this.promptedRatingIds.has(newlyCompleted._id)) return;
    this.completedSeen.add(newlyCompleted._id);
    this.promptedRatingIds.add(newlyCompleted._id);
    const modal = await this.modalController.create({
      component: OrderRatingComponent,
      componentProps: { orderId: newlyCompleted._id, dishName: newlyCompleted.dishName }
    });
    await modal.present();
    await modal.onDidDismiss();
  }

  private hasRated(order: Order): boolean {
    const ratings = Array.isArray(order?.ratings) ? order.ratings : [];
    return ratings.some((r: any) => r.role === 'chef');
  }
    
  //food profile modal
  async openModalFood(foodId: string) {
    // Call fetchFood only when opening the modal
    this.fetchFood(foodId);

    const modal = await this.modalController.create({
      component: FoodProfileComponent,
      componentProps: { foodId }
    });
    await modal.present();
  }

  

///order details model
  async openModalOrder(orderId: string) {
    // Call fetchFood only when opening the modal
    try { await this.modalController.dismiss(); } catch (e) {}
    this.fetchOrder(orderId);

    const modal = await this.modalController.create({
      component: OrderInfoComponent,
      componentProps: { orderId },
      cssClass: 'suga-order-fullsheet'
    });
    await modal.present();

  }

  // Fetch food details by ID
  fetchFood(foodId: string) {
    this.foodService.getFoodById(foodId).subscribe(
      (food: Food) => {
        // Handle the fetched food item as needed
        console.log('Fetched food:', food);
      },
      (error: any) => {
        console.error('Error fetching food:', error);
      }
    );
  }

  //fetch order by respective Id

  fetchOrder(orderId: string){
    this.orderService.getOrderById(orderId).subscribe(
      (order: Order)=>{
        console.log('orders', order);
      },
      (error:any)=>{
        console.log("can't fetch order ",error);
      }
    )
  }

  ////////////end food profile

  loadUserProfile(): void {
    this.userProfile = this.tokenStorage.getUser();
    if (this.userProfile && this.userProfile.username) {
      this.getFoodsByChef(this.userProfile.username);
      if (this.userProfile._id) {
        this.loadChefVideos(this.userProfile._id);
        this.loadChefFollowers(this.userProfile._id);
      }
      this.loadFollowingChefs();
    } else {
      console.error('User profile not available.');
    }
  }

  loadProfileDetails(): void {
    this.userService.getEditableProfile().subscribe({
      next: (profile) => {
        this.profileDetails = profile;
      },
      error: () => {}
    });
  }
  
  getFoodsByChef(username: string): void {
    this.isLoadingDishes = true;
    this.foodService.getFoodsByChef(username).subscribe(
      (foods: Food[]) => {
        if (foods.length === 0) {
          this.chefFoods = [];
          this.errorMessage = 'You have not added any foods yet<br>';
          this.promptMessage = 'Add a new dish.';
        } else {
          this.chefFoods = foods;
        }
        this.isLoadingDishes = false;
      },
      (error) => {
        console.error('Error fetching foods:', error);
        this.errorMessage = 'Unable to fetch your foods. Please try again later.';
        this.isLoadingDishes = false;
      }
    );
  }

  loadChefVideos(userId: string): void {
    this.isLoadingVideos = true;
    this.chefDashboardService.getChefVideos(userId).subscribe(
      (videos) => {
        this.videos = videos || [];
        this.isLoadingVideos = false;
      },
      (error) => {
        console.error('Error fetching chef videos:', error);
        this.isLoadingVideos = false;
      }
    );
  }

  loadChefFollowers(chefId: string): void {
    this.isLoadingFollowers = true;
    this.chefDashboardService.getChefFollowers(chefId).subscribe(
      (followers) => {
        this.followers = followers || [];
        this.isLoadingFollowers = false;
      },
      (error) => {
        console.error('Error fetching chef followers:', error);
        this.isLoadingFollowers = false;
      }
    );
  }
  

  newDish(): void {
    this.router.navigate(['./components/food-registration']);
  }

  goHome(): void {
    this.router.navigate(['/components/explore']);
  }

  newStory(): void {
    if (this.isStoryLaunching) return;
    this.isStoryLaunching = true;
    this.router.navigate(['components/foodstory']);
    this.storyLaunchTimer = setTimeout(() => {
      this.isStoryLaunching = false;
    }, 300);
  }
  chefOrders():void{
    this.router.navigate(['components/chef-orders']);
  }
  openNotifications(): void {
    this.router.navigate(['components/notifications']);
  }
  openWallet(): void {
    this.router.navigate(['components/wallet']);
  }
  openRewards(): void {
    this.router.navigate(['components/rewards']);
  }

  updateProfile(): void {
    this.router.navigate(['components/edit-profile']);
  }

  openSettings(): void {
    this.router.navigate(['components/profile-update']);
  }

  logout(): void {
    this.tokenStorage.signOut();
    this.router.navigate(['/login']);
  }

  getImageUrl(imageName: string): string {
    return `${environment.uploadUrl}/${imageName}`;
  }

  private normalizePath(value?: string): string {
    return value ? value.replace(/\\/g, '/') : '';
  }

  getProfileImage(profilePicture?: string): string {
    const cleaned = this.normalizePath(profilePicture);
    if (!cleaned) return `/assets/img/regpage.jpeg`;
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

  getCoverImage(coverPicture?: string, profilePicture?: string): string {
    const cleaned = this.normalizePath(coverPicture);
    if (!cleaned) {
      return this.getProfileImage(profilePicture);
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

  get imageTargetLabel(): string {
    return this.imageTarget === 'cover' ? 'Cover Photo' : 'Profile Photo';
  }

  openImageSheet(target: 'profile' | 'cover'): void {
    this.imageTarget = target;
    this.showImageSheet = true;
  }

  closeImageSheet(): void {
    this.showImageSheet = false;
    this.captureMode = null;
  }

  selectFromGallery(): void {
    this.captureMode = null;
    this.triggerFileInput();
  }

  selectFromCamera(): void {
    this.captureMode = 'environment';
    this.triggerFileInput();
  }

  private triggerFileInput(): void {
    setTimeout(() => this.imageInput?.nativeElement.click(), 50);
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !this.userProfile) {
      return;
    }
    const currentProfile = this.userProfile;
    const formData = new FormData();
    const field = this.imageTarget === 'cover' ? 'coverPicture' : 'profilePicture';
    formData.append(field, file);
    formData.append('username', currentProfile.username);

    const upload$ = this.imageTarget === 'cover'
      ? this.userService.uploadCoverPicture(formData)
      : this.userService.uploadProfilePicture(formData);

    upload$.subscribe({
      next: (user) => {
        this.userProfile = {
          ...currentProfile,
          profilePicture: user?.profilePicture ?? currentProfile.profilePicture,
          coverPicture: user?.coverPicture ?? currentProfile.coverPicture
        };
        const stored = this.tokenStorage.getUser();
        if (stored) {
          this.tokenStorage.saveUser({
            ...stored,
            profilePicture: this.userProfile?.profilePicture,
            coverPicture: this.userProfile?.coverPicture
          });
        }
        this.uiFeedback.success('Photo updated.');
        this.closeImageSheet();
      },
      error: (error) => {
        console.error('Error uploading image:', error);
        this.uiFeedback.error('Unable to upload photo.');
      }
    });
  }

  getVideoUrl(path: string): string {
    return `${environment.baseUrl}/${path}`;
  }

  openVideoModal(video: any): void {
    this.selectedVideo = video;
    this.isVideoModalOpen = true;
  }

  closeVideoModal(): void {
    this.isVideoModalOpen = false;
    this.selectedVideo = null;
  }

  async openVideoActions(video: any): Promise<void> {
    const actionSheet = await this.actionSheetController.create({
      header: 'Video Options',
      buttons: [
        {
          text: 'Edit Description',
          icon: 'create-outline',
          handler: () => this.promptEditDescription(video)
        },
        {
          text: 'Edit Privacy',
          icon: 'lock-closed-outline',
          handler: () => this.promptEditVisibility(video)
        },
        {
          text: 'Save Video',
          icon: 'bookmark-outline',
          handler: () => this.saveVideo(video)
        },
        {
          text: 'Share',
          icon: 'share-social-outline',
          handler: () => this.shareVideo(video)
        },
        {
          text: 'Delete',
          icon: 'trash-outline',
          role: 'destructive',
          handler: () => this.confirmDeleteVideo(video)
        },
        {
          text: 'Cancel',
          icon: 'close-outline',
          role: 'cancel'
        }
      ]
    });
    await actionSheet.present();
  }

  private async promptEditDescription(video: any): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Edit Description',
      inputs: [
        {
          name: 'description',
          type: 'textarea',
          value: video?.description || '',
          placeholder: 'Describe your video'
        }
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Update',
          handler: (data) => {
            const description = String(data?.description || '').trim();
            if (!description) {
              this.uiFeedback.error('Description cannot be empty.');
              return false;
            }
            this.chefDashboardService.updateVideoDescription(video._id, description).subscribe({
              next: () => {
                video.description = description;
                if (this.selectedVideo && this.selectedVideo._id === video._id) {
                  this.selectedVideo.description = description;
                }
                this.uiFeedback.success('Video description updated.');
              },
              error: (err) => {
                this.uiFeedback.error(err?.error?.message || 'Unable to update description.');
              }
            });
            return true;
          }
        }
      ]
    });
    await alert.present();
  }

  private async promptEditVisibility(video: any): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Story Privacy',
      inputs: [
        {
          name: 'visibility',
          type: 'radio',
          label: 'Public',
          value: 'public',
          checked: (video?.visibility || 'public') === 'public'
        },
        {
          name: 'visibility',
          type: 'radio',
          label: 'Followers only',
          value: 'followers',
          checked: (video?.visibility || 'public') === 'followers'
        },
        {
          name: 'visibility',
          type: 'radio',
          label: 'Only me',
          value: 'private',
          checked: (video?.visibility || 'public') === 'private'
        }
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Update',
          handler: (data) => {
            const visibility = String(data?.visibility || 'public') as 'public' | 'followers' | 'private';
            this.chefDashboardService.updateVideoSettings(video._id, { description: video?.description || 'Updated story', visibility }).subscribe({
              next: () => {
                video.visibility = visibility;
                if (this.selectedVideo && this.selectedVideo._id === video._id) {
                  this.selectedVideo.visibility = visibility;
                }
                this.uiFeedback.success('Story privacy updated.');
              },
              error: (err) => {
                this.uiFeedback.error(err?.error?.message || 'Unable to update story privacy.');
              }
            });
            return true;
          }
        }
      ]
    });
    await alert.present();
  }

  private async confirmDeleteVideo(video: any): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Delete Video',
      message: 'This action cannot be undone. Delete this video?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: () => this.deleteVideo(video)
        }
      ]
    });
    await alert.present();
  }

  private deleteVideo(video: any): void {
    this.chefDashboardService.deleteVideo(video._id).subscribe({
      next: () => {
        this.videos = this.videos.filter((v) => v._id !== video._id);
        if (this.selectedVideo && this.selectedVideo._id === video._id) {
          this.closeVideoModal();
        }
        this.uiFeedback.success('Video deleted.');
      },
      error: (err) => {
        this.uiFeedback.error(err?.error?.message || 'Unable to delete video.');
      }
    });
  }

  private saveVideo(video: any): void {
    this.chefDashboardService.saveVideo(video._id).subscribe({
      next: () => this.uiFeedback.success('Video saved to your collection.'),
      error: (err) => this.uiFeedback.error(err?.error?.message || 'Unable to save video.')
    });
  }

  private async shareVideo(video: any): Promise<void> {
    const url = this.getVideoUrl(video.path);
    const text = video.description ? `${video.description}\n${url}` : url;

    if ((navigator as any).share) {
      try {
        await (navigator as any).share({
          title: 'SUGA Video',
          text,
          url
        });
        return;
      } catch (_err) {
        // fallback to clipboard below
      }
    }

    try {
      await navigator.clipboard.writeText(text);
      this.uiFeedback.success('Video link copied. You can share it with users, chefs or other platforms.');
    } catch (_err) {
      this.uiFeedback.error('Unable to share video right now.');
    }
  }

  getFollowerImage(profilePicture: string): string {
    const cleaned = this.normalizePath(profilePicture);
    if (!cleaned) return `/assets/img/regpage.jpeg`;
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

  async openFollowerProfile(follower: any, initialStatTab: 'dishes' | 'stories' | 'followers' = 'dishes'): Promise<void> {
    if (!follower?.username) return;
    const modal = await this.modalController.create({
      component: ProfileModalComponent,
      componentProps: { username: follower.username, initialStatTab },
      cssClass: 'suga-profile-sheet',
      handle: true,
      initialBreakpoint: 0.76,
      breakpoints: [0, 0.76, 0.94]
    });
    await modal.present();
  }

  canFollowBack(follower: any): boolean {
    const roleList = Array.isArray(follower?.roles) ? follower.roles.map((r: string) => String(r).toLowerCase()) : [];
    const isChef = roleList.includes('chef');
    const followerId = String(follower?._id || '');
    const me = String(this.userProfile?._id || '');
    return !!followerId && followerId !== me && isChef;
  }

  isChefFollower(follower: any): boolean {
    const roleList = Array.isArray(follower?.roles) ? follower.roles.map((r: string) => String(r).toLowerCase()) : [];
    return roleList.includes('chef');
  }

  isFollowingFollower(followerId: string): boolean {
    return this.followedChefIds.has(String(followerId || ''));
  }

  followBack(follower: any, event: Event): void {
    event.stopPropagation();
    const followerId = String(follower?._id || '');
    if (!followerId) return;
    this.userService.toggleFollowChef(followerId).subscribe({
      next: (res) => {
        if (res.following) {
          this.followedChefIds.add(followerId);
          this.uiFeedback.success('Now following back.');
        } else if (res.pending) {
          this.uiFeedback.success('Follow request sent.');
        } else {
          this.followedChefIds.delete(followerId);
          this.uiFeedback.success('Unfollowed.');
        }
      },
      error: (err) => this.uiFeedback.error(err?.error?.message || 'Unable to follow back.')
    });
  }

  private loadFollowingChefs(): void {
    this.userService.getFollowingChefIds().subscribe({
      next: (data) => {
        this.followedChefIds = new Set((data?.followingChefs || []).map((id: any) => String(id)));
      },
      error: () => {
        this.followedChefIds.clear();
      }
    });
  }

  ngOnDestroy(): void {
    if (this.storyLaunchTimer) {
      clearTimeout(this.storyLaunchTimer);
    }
  }
}
