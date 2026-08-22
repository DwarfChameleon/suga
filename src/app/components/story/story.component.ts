import { Component, ElementRef, HostListener, Input, OnInit, ViewChild, ViewChildren, AfterViewInit, QueryList } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, firstValueFrom, forkJoin, of } from 'rxjs';
import { UserDetails } from 'src/app/interface/user-details';
import { UserService } from 'src/app/services/user.service';
import { ProfileModalComponent } from '../profile-modal/profile-modal.component';
import { ModalController } from '@ionic/angular';
import { environment } from 'src/environments/environment';
import { TokenStorageService } from 'src/app/services/token-storage.service';
import { ActivatedRoute, Router } from '@angular/router';
import { NetworkService } from 'src/app/services/network.service';
import { UiFeedbackService } from 'src/app/services/ui-feedback.service';
import { LoginModalComponent } from 'src/app/login-modal/login-modal.component';
import { LikeEffectsService } from 'src/app/services/like-effects.service';
import { FoodService } from 'src/app/services/food.service';
import { Food } from 'src/app/interface/food';
import { OrderModalComponent } from '../order-modal/order-modal.component';
import { buildLocationLabel } from 'src/app/utils/location-label';

interface LinkedFoodSnapshot {
  dishName?: string;
  price?: number;
  preparationTime?: string;
  chefID?: string;
  chefUsername?: string;
  image?: string;
  category?: string;
  ingredients?: string[] | string;
  ingredientsList?: string[];
  country?: string;
  state?: string;
  region?: string;
  city?: string;
  suburb?: string;
  neighborhood?: string;
  neighbourhood?: string;
  localGovernment?: string;
}

interface Video {
  _id: string;
  userId: string;
  username: string;
  path: string;
  description: string;
  hashtags?: string[];
  mentions?: string[];
  uploadedAt: string;
  likes: number;
  likedBy?: string[];
  likedByMe?: boolean;
  comments: Comment[];
  showComments?: boolean;
  showCommentForm?: boolean;
  orderEnabled?: boolean;
  linkedFoodId?: string;
  linkedFood?: LinkedFoodSnapshot;
  featured?: boolean;
  isFeatured?: boolean;
  isPublic?: boolean;
  public?: boolean;
  visibility?: string;
  status?: string;
  dishName?: string;
  ingredients?: string[] | string;
  ingredientsList?: string[];
  country?: string;
  state?: string;
  region?: string;
  city?: string;
  suburb?: string;
  neighborhood?: string;
  neighbourhood?: string;
  localGovernment?: string;
}

interface Comment {
  userId: string;
  username: string;
  text: string;
  createdAt: string;
}

type StoryTabKey = 'explore' | 'following' | 'forYou';

interface StoryTab {
  key: StoryTabKey;
  label: string;
}

interface DietPreferences {
  allergies: string[];
  desiredIngredients: string[];
}

@Component({
  selector: 'app-story',
  templateUrl: './story.component.html',
  styleUrls: ['./story.component.scss'],
})
export class StoryComponent implements OnInit {
  @Input() presentedAsModal = false;
  @Input() initialVideoId = '';
  @ViewChild('video') video: ElementRef<HTMLVideoElement> | undefined;
  @ViewChildren('videoEl') videoEls!: QueryList<ElementRef<HTMLVideoElement>>;
  private observer?: IntersectionObserver;
  private currentPlayingId?: string;
  @HostListener('window:scroll',[])
  videos: Video[] = [];
  newComment: any;
  userDetails: UserDetails | undefined;
  rect:string | undefined;
  private viewedIds = new Set<string>();
  private viewTimers: Record<string, any> = {};
  emptyMessage = '';
  showCommentsPanel = false;
  activeVideo?: Video;
  commentText = '';
  private targetVideoId?: string;
  isLoading = false;
  isOnline = true;
  storyHeartBursts: Record<string, number[]> = {};
  playbackHint: Record<string, 'play' | 'pause' | ''> = {};
  private playbackTimers: Record<string, any> = {};
  private seenStoryIds = new Set<string>();
  private brokenVideoIds = new Set<string>();
  storyTabs: StoryTab[] = [
    { key: 'explore', label: 'Explore' },
    { key: 'following', label: 'Following' },
    { key: 'forYou', label: 'For you' }
  ];
  activeStoryTab: StoryTabKey = 'explore';
  private exploreVideos: Video[] = [];
  private followingVideos: Video[] = [];
  private forYouVideos: Video[] = [];
  private dietPreferences: DietPreferences = { allergies: [], desiredIngredients: [] };

  constructor(
    private http: HttpClient,
    private userService:UserService,
    private modalController: ModalController,
    private tokenStorage: TokenStorageService,
    private router: Router,
    private route: ActivatedRoute,
    private networkService: NetworkService,
    private uiFeedback: UiFeedbackService,
    private likeEffects: LikeEffectsService,
    private foodService: FoodService
    ) {}

  ngOnInit(): void {
    const target = this.initialVideoId || this.route.snapshot.queryParamMap.get('videoId');
    if (target) this.targetVideoId = target;

    this.networkService.online$.subscribe((online) => {
      this.isOnline = online;
    });
    const user = this.tokenStorage.getUser();
    if (user) {
      this.userDetails = user;
      this.dietPreferences = this.getDietPreferences(user);
      this.hydrateSeenStories();
    }
    this.loadStoryFeeds();
    this.userService.followChanged$.subscribe(() => {
      this.reloadVideos();
    });
  }

  switchStoryTab(tab: StoryTabKey): void {
    if (this.activeStoryTab === tab) return;
    if (this.currentPlayingId) {
      this.pauseVideoById(this.currentPlayingId);
      this.currentPlayingId = undefined;
    }
    this.activeStoryTab = tab;
    this.applyActiveStoryTab();
  }

  getStoryTabCount(tab: StoryTabKey): number {
    return this.getVideosForTab(tab).length;
  }

  private loadStoryFeeds(): void {
    this.isLoading = true;
    const canLoadFollowing = !!this.tokenStorage.getAccessToken();
    const publicVideos$ = this.http.get<any[]>(`${environment.apiUrl}/videos`).pipe(catchError(() => of([])));
    const followedVideos$ = canLoadFollowing
      ? this.http.get<any[]>(`${environment.apiUrl}/videos/followed`).pipe(catchError(() => of([])))
      : of([]);

    forkJoin({
      publicVideos: publicVideos$,
      followedVideos: followedVideos$
    }).subscribe(({ publicVideos, followedVideos }) => {
      const preparedPublic = this.prepareVideos(publicVideos);
      this.exploreVideos = this.sortExploreVideos(preparedPublic);
      this.followingVideos = this.prepareVideos(followedVideos);
      this.forYouVideos = this.buildForYouVideos(this.exploreVideos);
      this.isLoading = false;
      this.applyActiveStoryTab();
      this.scrollToTarget();
      this.queueInitialAutoplay();
    });
  }

  private prepareVideos(items: any[]): Video[] {
    const currentUser = this.tokenStorage.getUser();
    return (items || [])
      .filter((v) => !!v?._id && !!v?.path)
      .map((v: Video) => ({
        ...v,
        comments: Array.isArray(v.comments) ? v.comments : [],
        likedByMe: currentUser?._id ? (v.likedBy || []).includes(currentUser._id) : false,
        showComments: false,
        showCommentForm: false
      }));
  }

  private sortExploreVideos(videos: Video[]): Video[] {
    return [...videos]
      .filter((video) => this.isPublicVideo(video))
      .sort((a, b) => {
        const featuredDiff = Number(!!(b.featured || b.isFeatured)) - Number(!!(a.featured || a.isFeatured));
        if (featuredDiff !== 0) return featuredDiff;
        return new Date(b.uploadedAt || 0).getTime() - new Date(a.uploadedAt || 0).getTime();
      });
  }

  private buildForYouVideos(videos: Video[]): Video[] {
    const prefs = this.dietPreferences;
    const hasPrefs = prefs.allergies.length > 0 || prefs.desiredIngredients.length > 0;
    if (!hasPrefs) {
      return videos.slice(0, 25);
    }

    const scored = videos
      .map((video) => ({ video, score: this.getDietMatchScore(video, prefs) }))
      .filter((item) => item.score >= 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return new Date(b.video.uploadedAt || 0).getTime() - new Date(a.video.uploadedAt || 0).getTime();
      });

    return scored.map((item) => item.video);
  }

  private getDietMatchScore(video: Video, prefs: DietPreferences): number {
    const searchable = this.getSearchableVideoText(video);
    const hasAllergy = prefs.allergies.some((term) => this.matchesAnyText(searchable, term));
    if (hasAllergy) return -1;

    const desiredMatches = prefs.desiredIngredients.filter((term) => this.matchesAnyText(searchable, term)).length;
    return desiredMatches > 0 ? desiredMatches + 2 : 0;
  }

  private getSearchableVideoText(video: Video): string[] {
    const linkedFood = video.linkedFood || {};
    return [
      video.description,
      video.dishName,
      linkedFood.dishName,
      linkedFood.category,
      linkedFood.chefUsername,
      ...(video.hashtags || []),
      ...this.normalizeIngredientTerms(video.ingredients),
      ...this.normalizeIngredientTerms(video.ingredientsList),
      ...this.normalizeIngredientTerms(linkedFood.ingredients),
      ...this.normalizeIngredientTerms(linkedFood.ingredientsList)
    ].filter((value): value is string => !!String(value || '').trim());
  }

  private normalizeIngredientTerms(value: string[] | string | undefined): string[] {
    if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
    if (!value) return [];
    return String(value)
      .split(/[,;\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private matchesAnyText(values: string[], term: string): boolean {
    const needle = String(term || '').trim().toLowerCase();
    if (!needle) return false;
    return values.some((value) => String(value || '').toLowerCase().includes(needle));
  }

  private isPublicVideo(video: Video): boolean {
    const visibility = String(video.visibility || video.status || 'public').toLowerCase();
    return video.isPublic !== false
      && video.public !== false
      && !['private', 'draft', 'deleted', 'inactive'].includes(visibility);
  }

  private getDietPreferences(user: any): DietPreferences {
    const prefs = user?.dietPreferences || user?.profile?.dietPreferences || {};
    return {
      allergies: this.normalizeIngredientTerms(prefs.allergies || prefs.allergicItems),
      desiredIngredients: this.normalizeIngredientTerms(prefs.desiredIngredients || prefs.interests || prefs.interestedItems)
    };
  }

  private applyActiveStoryTab(): void {
    this.videos = [...this.getVideosForTab(this.activeStoryTab)];
    this.emptyMessage = this.getEmptyMessageForTab(this.activeStoryTab);
    setTimeout(() => {
      this.setupObserver();
      this.queueInitialAutoplay();
    }, 0);
  }

  private getVideosForTab(tab: StoryTabKey): Video[] {
    if (tab === 'following') return this.followingVideos;
    if (tab === 'forYou') return this.forYouVideos;
    return this.exploreVideos;
  }

  private getEmptyMessageForTab(tab: StoryTabKey): string {
    if (this.getVideosForTab(tab).length > 0) return '';
    if (tab === 'following') return 'Follow chefs, restaurants, or food creators to see their stories here.';
    if (tab === 'forYou') return 'Update your diet preferences to improve your story suggestions.';
    return 'No public food stories yet.';
  }

  getVideoUrl(path: string): string {
    const normalized = this.normalizeVideoPath(path);
    if (!normalized) return '';
    if (/^https?:\/\//i.test(normalized)) return normalized;
    if (normalized.startsWith('videos/') || normalized.startsWith('uploads/')) {
      return `${environment.baseUrl}/${normalized}`;
    }
    return `${environment.baseUrl}/videos/${normalized}`;
  }

  getStoryLocationLabel(video: Video): string {
    return buildLocationLabel(video.linkedFood) || buildLocationLabel(video);
  }
 onScroll(){
   
    if(this.video && this.video.nativeElement){
    const videoElement = this.video.nativeElement;
    const rect = videoElement.getBoundingClientRect();
    const isVisible = rect.top< window.innerHeight && rect.bottom> 0;
    if(isVisible){
      videoElement.play();
    }
    else{
      videoElement.pause();
    }
  }
  }
  togglePlayPause(videoElement: HTMLVideoElement, videoId?: string): void {
    if (videoId && this.isVideoUnavailable(videoId)) {
      return;
    }
    if (videoElement) {
      if (videoElement.paused) {
        videoElement.play().catch(() => {});
        if (videoId) this.scheduleView(videoId);
        if (videoId) this.showPlaybackHint(videoId, 'play');
      } else {
        videoElement.pause();
        if (videoId) this.cancelView(videoId);
        if (videoId) this.showPlaybackHint(videoId, 'pause');
      }
    }
  }

  private showPlaybackHint(videoId: string, state: 'play' | 'pause'): void {
    this.playbackHint[videoId] = state;
    if (this.playbackTimers[videoId]) {
      clearTimeout(this.playbackTimers[videoId]);
    }
    this.playbackTimers[videoId] = setTimeout(() => {
      this.playbackHint[videoId] = '';
      delete this.playbackTimers[videoId];
    }, 700);
  }

  likeVideo(video: Video): void {
    if (!this.tokenStorage.getAccessToken()) {
      this.uiFeedback.error('Please login to like a video.');
      this.openLoginModal();
      return;
    }
    if (video.likedByMe) {
      this.uiFeedback.error(this.likeEffects.alreadyLikedMessage);
      return;
    }
    this.http.post<{ likes: number; liked: boolean }>(`${environment.apiUrl}/videos/${video._id}/like`, {}).subscribe((data) => {
      if (data?.liked) {
        this.triggerStoryHeartBurst(video._id);
      }
      this.videos = this.videos.map((v) =>
        v._id === video._id ? { ...v, likes: data.likes, likedByMe: data.liked } : v
      );
    });
  }

  private triggerStoryHeartBurst(videoId: string): void {
    this.likeEffects.applyHeartBurst(this.storyHeartBursts, videoId);
  }

  addComment(videoId: string): void {
    if (this.newComment.trim() && this.userDetails) {
      const comment = { text: this.newComment };
      this.http.post<Video>(`${environment.apiUrl}/videos/${videoId}/comment`, comment).subscribe((data) => {
        this.videos = this.videos.map((video) =>
          video._id === videoId ? { ...video, comments: data.comments } : video
        );
        this.newComment = '';
        this.videos.find(video => video._id === videoId)!.showCommentForm = false;
      });
    }
  }

  markViewed(videoId: string): void {
    if (!this.tokenStorage.getAccessToken()) return;
    if (this.viewedIds.has(videoId)) return;
    this.viewedIds.add(videoId);
    this.seenStoryIds.add(videoId);
    this.persistSeenStories();
    this.http.post(`${environment.apiUrl}/videos/${videoId}/view`, {}).subscribe();
  }

  scheduleView(videoId: string): void {
    if (this.viewedIds.has(videoId)) return;
    if (this.viewTimers[videoId]) return;
    this.viewTimers[videoId] = setTimeout(() => {
      delete this.viewTimers[videoId];
      this.markViewed(videoId);
    }, 3000);
  }

  cancelView(videoId: string): void {
    if (this.viewTimers[videoId]) {
      clearTimeout(this.viewTimers[videoId]);
      delete this.viewTimers[videoId];
    }
  }
  cancelComment() {
    this.newComment = '';
  }

  dismissModal(): void {
    this.modalController.dismiss();
  }

  toggleComments(video: Video): void {
    video.showComments = !video.showComments;
  }

  showCommentForm(video: Video): void {
    video.showCommentForm = true;
  
  }

  async openProfileModal(username: string, videoElement: HTMLVideoElement): Promise<void> {
    if (username) {
      videoElement.pause(); // Pause the video
  
      // Add no-scroll class to body
      document.body.classList.add('no-scroll');
  
      const modal = await this.modalController.create({
        component: ProfileModalComponent,
        componentProps: { username }
      });
      modal.onDidDismiss().then((result) => {
        console.log('Modal dismissed with result:', result);
        videoElement.play();
        document.body.classList.remove('no-scroll');
      });
      await modal.present();
    } else {
      console.error('Username is undefined');
    }
  }

  ngAfterViewInit(): void {
    this.setupObserver();
    this.videoEls.changes.subscribe(() => {
      this.setupObserver();
      this.queueInitialAutoplay();
    });
    this.queueInitialAutoplay();
  }

  private setupObserver(): void {
    if (this.observer) this.observer.disconnect();

    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          const target = entry.target as HTMLVideoElement;
          const videoId = target.dataset['id'];
          if (!videoId) return;

          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            if (this.currentPlayingId && this.currentPlayingId !== videoId) {
              this.pauseVideoById(this.currentPlayingId);
            }
            this.currentPlayingId = videoId;
            target.play().catch(() => {});
            this.scheduleView(videoId);
          } else {
            if (this.currentPlayingId === videoId) {
              this.currentPlayingId = undefined;
            }
            target.pause();
            this.cancelView(videoId);
          }
        });
      },
      { threshold: [0.6] }
    );

    this.videoEls.forEach(el => this.observer?.observe(el.nativeElement));
  }

  private pauseVideoById(videoId: string): void {
    const el = this.videoEls?.find(v => v.nativeElement.dataset['id'] === videoId);
    if (el) {
      try { el.nativeElement.pause(); } catch {}
    }
  }

  isVideoUnavailable(videoId: string): boolean {
    return this.brokenVideoIds.has(String(videoId || ''));
  }

  onVideoError(videoId: string, videoElement?: HTMLVideoElement): void {
    const id = String(videoId || '');
    if (!id) return;
    this.brokenVideoIds.add(id);
    this.cancelView(id);
    if (this.currentPlayingId === id) {
      this.currentPlayingId = undefined;
    }
    try {
      videoElement?.pause();
    } catch {}
  }

  private normalizeVideoPath(path: string): string {
    return String(path || '')
      .trim()
      .replace(/\\/g, '/')
      .replace(/^\.\//, '')
      .replace(/^\/+/, '');
  }

  private queueInitialAutoplay(): void {
    setTimeout(() => {
      const targetId = this.targetVideoId && !this.isVideoUnavailable(this.targetVideoId)
        ? this.targetVideoId
        : String(this.videos.find((video) => !this.isVideoUnavailable(video._id))?._id || '');
      if (!targetId) return;
      const el = this.videoEls?.find((videoRef) => videoRef.nativeElement.dataset['id'] === targetId)?.nativeElement;
      if (!el) return;
      try {
        el.muted = true;
        el.play().catch(() => {});
        this.scheduleView(targetId);
        this.currentPlayingId = targetId;
      } catch {}
    }, 180);
  }

  openComments(video: Video): void {
    this.activeVideo = video;
    this.showCommentsPanel = true;
    this.commentText = '';
    document.body.classList.add('no-scroll');
  }

  closeComments(): void {
    this.showCommentsPanel = false;
    this.activeVideo = undefined;
    document.body.classList.remove('no-scroll');
  }

  postComment(): void {
    if (!this.tokenStorage.getAccessToken()) {
      this.uiFeedback.error('Please login to comment.');
      this.openLoginModal();
      return;
    }
    if (!this.activeVideo || !this.commentText.trim()) return;
    const text = this.commentText;
    this.http.post<Video>(`${environment.apiUrl}/videos/${this.activeVideo._id}/comment`, { text }).subscribe((data) => {
      this.videos = this.videos.map(v =>
        v._id === this.activeVideo!._id ? { ...v, comments: data.comments } : v
      );
      if (this.activeVideo) {
        this.activeVideo = this.videos.find(v => v._id === this.activeVideo!._id);
      }
      this.commentText = '';
    });
  }

  private reloadVideos(): void {
    this.dietPreferences = this.getDietPreferences(this.tokenStorage.getUser());
    this.loadStoryFeeds();
  }

  private scrollToTarget(): void {
    if (!this.targetVideoId) return;
    setTimeout(() => {
      const el = document.querySelector(`[data-id="${this.targetVideoId}"]`) as HTMLVideoElement | null;
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 0);
  }

  openTag(tag: string): void {
    this.router.navigate(['/components/search'], { queryParams: { q: `#${tag}` } });
  }

  openMention(username: string): void {
    this.router.navigate(['/components/search'], { queryParams: { q: `@${username}` } });
  }

  async openOrderFromStory(video: Video): Promise<void> {
    if (!this.tokenStorage.getAccessToken()) {
      this.uiFeedback.error('Please login to place an order.');
      await this.openLoginModal();
      return;
    }
    if (!video.orderEnabled) {
      this.uiFeedback.error('Ordering is disabled for this story.');
      return;
    }

    const linkedId = String(video.linkedFoodId || '').trim();
    let dish: Food | null = null;
    if (linkedId) {
      dish = await firstValueFrom(
        this.foodService.getFoodById(linkedId).pipe(catchError(() => of(null)))
      );
    }

    const snapshot = video.linkedFood || {};
    const dishName = dish?.dishName || snapshot.dishName || 'Dish';
    const price = Number(dish?.price ?? snapshot.price ?? 0);
    const preparationTime = dish?.preparationTime || snapshot.preparationTime || '';
    const chefID = dish?.chefID || snapshot.chefID || video.userId;
    const chefName = (dish?.chef as string) || snapshot.chefUsername || video.username;
    const image = dish?.image || snapshot.image || '';
    const category = dish?.category || snapshot.category || '';
    const foodId = dish?._id || linkedId;

    if (!foodId || !chefID) {
      this.uiFeedback.error('This story is not linked to an orderable dish.');
      return;
    }

    const modal = await this.modalController.create({
      component: OrderModalComponent,
      componentProps: {
        dishName,
        price,
        preparationTime,
        chefName,
        chefID,
        food_id: foodId,
        image,
        category,
        user: this.tokenStorage.getUser()
      }
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

  private getSeenStorageKey(): string {
    const uid = this.tokenStorage.getUser()?._id || 'guest';
    return `suga_story_seen_${uid}`;
  }

  private hydrateSeenStories(): void {
    try {
      const raw = localStorage.getItem(this.getSeenStorageKey());
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) {
        this.seenStoryIds = new Set(parsed.map((x) => String(x)));
      }
    } catch {
      this.seenStoryIds = new Set<string>();
    }
  }

  private persistSeenStories(): void {
    try {
      localStorage.setItem(this.getSeenStorageKey(), JSON.stringify(Array.from(this.seenStoryIds)));
      localStorage.setItem('suga_story_last_seen', new Date().toISOString());
    } catch {}
  }
}
