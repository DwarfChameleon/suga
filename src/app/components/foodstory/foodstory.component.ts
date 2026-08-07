import { Component, OnInit, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { MediaCapture } from '@awesome-cordova-plugins/media-capture/ngx';
import { Capacitor } from '@capacitor/core';
import { UiFeedbackService } from 'src/app/services/ui-feedback.service';
import { LoadingService } from 'src/app/services/loading.service';
import { TokenStorageService } from 'src/app/services/token-storage.service';
import { FoodService } from 'src/app/services/food.service';
import { Food } from 'src/app/interface/food';
import { ModalController } from '@ionic/angular';
import { Router } from '@angular/router';
import { StoryComponent } from '../story/story.component';

type StoryStep = 'capture' | 'review' | 'details';

@Component({
  selector: 'app-foodstory',
  templateUrl: './foodstory.component.html',
  styleUrls: ['./foodstory.component.scss'],
})
export class FoodstoryComponent implements OnInit, OnDestroy {
  mediaFile: File | null = null;
  description = '';
  contentCategory: '' | 'food' | 'snacks' | 'beverage' | 'dinner' | 'restaurant' = '';
  uploadStatus = '';
  previewUrl: SafeUrl | null = null;
  mediaType: 'video' | 'image' | null = null;
  orderEnabled = false;
  linkedFoodId = '';
  isSuccessModalOpen = false;
  uploadedVideo: any | null = null;
  myDishes: Food[] = [];
  step: StoryStep = 'capture';
  readonly createDishValue = '__create_new__';

  selectedFilter = 'none';
  visibility: 'public' | 'followers' | 'private' = 'public';
  readonly filters = [
    { value: 'none', label: 'None', css: 'none' },
    { value: 'warm', label: 'Warm', css: 'saturate(1.2) contrast(1.05) sepia(0.2)' },
    { value: 'cool', label: 'Cool', css: 'saturate(0.95) contrast(1.05) hue-rotate(12deg)' },
    { value: 'vivid', label: 'Vivid', css: 'saturate(1.45) contrast(1.12)' },
    { value: 'mono', label: 'Mono', css: 'grayscale(1) contrast(1.1)' }
  ];

  private apiUrl = `${environment.apiUrl}`;
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('liveVideo') liveVideo!: ElementRef<HTMLVideoElement>;

  isRecording = false;
  recorder: MediaRecorder | null = null;
  mediaStream: MediaStream | null = null;
  recordedChunks: Blob[] = [];
  facingMode: 'user' | 'environment' = 'environment';
  timer = 0;
  timerInterval: any = null;
  readonly contentCategories: Array<'food' | 'snacks' | 'beverage' | 'dinner' | 'restaurant'> = [
    'food',
    'snacks',
    'beverage',
    'dinner',
    'restaurant'
  ];

  constructor(
    private http: HttpClient,
    private sanitizer: DomSanitizer,
    private mediaCapture: MediaCapture,
    private uiFeedback: UiFeedbackService,
    private loadingService: LoadingService,
    private tokenStorage: TokenStorageService,
    private foodService: FoodService,
    private modalController: ModalController,
    private router: Router
  ) {}

  ngOnInit() {
    const username = this.tokenStorage.getUser()?.username;
    if (username) {
      this.foodService.getFoodsByChef(username).subscribe({
        next: (foods) => {
          this.myDishes = foods || [];
        },
        error: () => {
          this.myDishes = [];
        }
      });
    }

    setTimeout(() => {
      this.startPreview();
    }, 150);
  }

  async ngOnDestroy() {
    await this.stopStream();
  }

  get selectedFilterCss(): string {
    return this.filters.find((f) => f.value === this.selectedFilter)?.css || 'none';
  }

  setStep(next: StoryStep): void {
    this.step = next;
    if (next === 'capture') {
      this.uploadStatus = '';
      this.startPreview();
    }
  }

  get headerTitle(): string {
    if (this.step === 'capture') return 'Capture Story';
    if (this.step === 'review') return 'Edit Story';
    return 'Story Details';
  }

  get canGoBack(): boolean {
    return this.step !== 'capture';
  }

  get shouldCreateDishAfterUpload(): boolean {
    return this.orderEnabled && this.linkedFoodId === this.createDishValue;
  }

  get uploadedVideoUrl(): string {
    return this.getVideoUrl(this.uploadedVideo?.path || '');
  }

  onHeaderBack(): void {
    if (this.step === 'details') {
      this.step = 'review';
      return;
    }
    if (this.step === 'review') {
      this.step = 'capture';
      this.startPreview();
    }
  }

  onHeaderDone(): void {
    if (this.step === 'details') {
      this.uploadMedia();
    }
  }

  handleFileInput(event: Event) {
    const target = event.target as HTMLInputElement;
    if (!target.files || target.files.length === 0) return;

    const file = target.files[0];
    this.mediaFile = file;
    this.mediaType = file.type.startsWith('image') ? 'image' : file.type.startsWith('video') ? 'video' : null;
    const url = URL.createObjectURL(file);
    this.previewUrl = this.sanitizer.bypassSecurityTrustUrl(url);
    this.step = 'review';
    this.stopStream();
  }

  openGallery() {
    if (this.fileInput && this.fileInput.nativeElement) {
      this.fileInput.nativeElement.click();
    }
  }

  async startPreview() {
    try {
      if (this.step !== 'capture') return;
      await this.stopStream();
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: this.facingMode },
        audio: true
      });
      if (this.liveVideo?.nativeElement) {
        this.liveVideo.nativeElement.srcObject = this.mediaStream;
        await this.liveVideo.nativeElement.play();
      }
    } catch (err) {
      console.error('Unable to start camera preview', err);
      this.uiFeedback.error('Unable to start camera preview.');
    }
  }

  async stopStream() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
    if (this.liveVideo?.nativeElement) {
      try {
        this.liveVideo.nativeElement.pause();
      } catch {}
      try {
        this.liveVideo.nativeElement.srcObject = null;
      } catch {}
    }
  }

  async switchCamera() {
    this.facingMode = this.facingMode === 'environment' ? 'user' : 'environment';
    await this.startPreview();
  }

  startTimer() {
    this.timer = 0;
    this.timerInterval = setInterval(() => (this.timer += 1), 1000);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  async toggleRecording() {
    if (this.isRecording) {
      this.stopRecording();
      return;
    }
    await this.startRecording();
  }

  async startRecording() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.uploadStatus = 'Recording not supported in this environment.';
      return;
    }
    try {
      if (!this.mediaStream) await this.startPreview();
      if (!this.mediaStream) return;

      this.recordedChunks = [];
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
        ? 'video/webm;codecs=vp8,opus'
        : 'video/webm';

      this.recorder = new MediaRecorder(this.mediaStream, { mimeType });
      this.recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data && e.data.size) this.recordedChunks.push(e.data);
      };
      this.recorder.onstop = () => {
        const blob = new Blob(this.recordedChunks, { type: this.recordedChunks[0]?.type || 'video/webm' });
        const file = new File([blob], `recorded_${Date.now()}.webm`, { type: blob.type });
        this.mediaFile = file;
        this.mediaType = 'video';
        this.previewUrl = this.sanitizer.bypassSecurityTrustUrl(URL.createObjectURL(blob));
        this.step = 'review';
        this.uploadStatus = 'Recording ready. Choose proceed or re-record.';
        this.stopStream();
      };

      this.recorder.start();
      this.isRecording = true;
      this.startTimer();
      this.uploadStatus = 'Recording... tap again to stop.';
    } catch (err) {
      console.error('Recording failed', err);
      this.uploadStatus = 'Recording failed';
      this.uiFeedback.error('Recording failed. Please try again.');
    }
  }

  stopRecording() {
    if (this.recorder && this.isRecording) {
      try {
        this.recorder.stop();
      } catch (e) {
        console.warn(e);
      }
    }
    this.isRecording = false;
    this.stopTimer();
  }

  keepAndContinue(): void {
    if (!this.mediaFile) {
      this.uiFeedback.error('Record or select a video first.');
      return;
    }
    this.step = 'details';
  }

  deleteAndRerecord(): void {
    this.mediaFile = null;
    this.mediaType = null;
    this.previewUrl = null;
    this.selectedFilter = 'none';
    this.step = 'capture';
    this.startPreview();
  }

  async uploadMedia() {
    if (!this.mediaFile) {
      this.uploadStatus = 'Please select a media file first.';
      this.uiFeedback.error(this.uploadStatus);
      return;
    }
    if (!this.contentCategory) {
      this.uploadStatus = 'Select a story category before uploading.';
      this.uiFeedback.error(this.uploadStatus);
      return;
    }
    if (!this.description?.trim()) {
      this.uploadStatus = 'Add a short food-related description.';
      this.uiFeedback.error(this.uploadStatus);
      return;
    }
    if (this.orderEnabled && !this.linkedFoodId) {
      this.uploadStatus = 'Select a dish to enable ordering from story.';
      this.uiFeedback.error(this.uploadStatus);
      return;
    }

    const formData = new FormData();
    formData.append('file', this.mediaFile, this.mediaFile.name);
    formData.append('description', this.description || '');
    formData.append('contentCategory', this.contentCategory);
    formData.append('type', this.mediaType || '');
    formData.append('orderEnabled', String(this.orderEnabled && !this.shouldCreateDishAfterUpload));
    formData.append('visibility', this.visibility);
    formData.append('filterPreset', this.selectedFilter);
    if (this.orderEnabled && this.linkedFoodId && !this.shouldCreateDishAfterUpload) {
      formData.append('linkedFoodId', this.linkedFoodId);
    }

    this.uploadStatus = 'Uploading...';
    await this.loadingService.show('Posting story...');
    try {
      let response: any;
      try {
        response = await this.http.post<any>(`${this.apiUrl}/upload-media`, formData).toPromise();
      } catch (primaryError: any) {
        if (primaryError?.status !== 404) {
          throw primaryError;
        }
        response = await this.http.post<any>(`${this.apiUrl}/upload-video`, formData).toPromise();
      }
      this.uploadStatus = response?.message || 'Upload successful';
      this.uploadedVideo = response?.video || null;
      this.isSuccessModalOpen = true;
      this.uiFeedback.success('Story posted successfully.');
      await this.loadingService.hide();
    } catch (error) {
      console.error('Error uploading media:', error);
      this.uploadStatus = 'Error uploading media';
      this.uiFeedback.error(this.uploadStatus);
      await this.loadingService.hide();
    }
  }

  async previewUploadedStory(): Promise<void> {
    const videoId = String(this.uploadedVideo?._id || '');
    this.closeSuccessModal();
    this.resetAll();
    if (!videoId) return;
    const modal = await this.modalController.create({
      component: StoryComponent,
      componentProps: { presentedAsModal: true, initialVideoId: videoId },
      cssClass: 'story-sheet-modal',
      handle: true,
      initialBreakpoint: 0.92,
      breakpoints: [0, 0.55, 0.92, 1]
    });
    await modal.present();
  }

  createDishForUploadedStory(): void {
    const videoId = String(this.uploadedVideo?._id || '');
    const description = String(this.uploadedVideo?.description || this.description || '');
    this.closeSuccessModal();
    this.resetAll();
    this.router.navigate(['/components/food-registration'], {
      state: {
        linkStoryVideoId: videoId,
        storyDescription: description
      }
    });
  }

  closeSuccessModal(): void {
    this.isSuccessModalOpen = false;
  }

  getVideoUrl(path: string): string {
    const cleaned = String(path || '').trim();
    if (!cleaned) return '';
    if (/^https?:\/\//i.test(cleaned)) return cleaned;
    if (cleaned.startsWith('videos/') || cleaned.startsWith('uploads/')) {
      return `${environment.baseUrl}/${cleaned}`;
    }
    return `${environment.baseUrl}/videos/${cleaned}`;
  }

  async captureVideo() {
    try {
      const result: any = await this.mediaCapture.captureVideo();
      if (!Array.isArray(result) || result.length === 0) return;

      const media = result[0] || {};
      const rawPath = String(media.localURL || media.fullPath || '').trim();
      if (!rawPath) {
        this.uiFeedback.error('Captured video could not be accessed.');
        return;
      }

      const previewPath = this.toWebViewSrc(rawPath);
      this.mediaFile = await this.createFileFromPath(rawPath, 'captured_story');
      this.mediaType = 'video';
      this.previewUrl = this.sanitizer.bypassSecurityTrustUrl(previewPath);
      this.uploadStatus = 'Captured video - proceed to details';
      this.step = 'review';
    } catch (err: any) {
      console.error('Capture error', err);
      this.uiFeedback.error('Capture error. Please try again.');
    }
  }

  private toWebViewSrc(pathValue: string): string {
    const source = String(pathValue || '').trim();
    if (!source) return source;
    if (/^https?:\/\//i.test(source) || source.startsWith('blob:') || source.startsWith('data:')) {
      return source;
    }
    if (source.startsWith('content://') || source.startsWith('file://')) {
      return Capacitor.convertFileSrc(source);
    }
    return source;
  }

  private async createFileFromPath(pathValue: string, baseName: string): Promise<File> {
    const webPath = this.toWebViewSrc(pathValue);
    const response = await fetch(webPath);
    if (!response.ok) {
      throw new Error(`Unable to read captured media (${response.status})`);
    }
    const blob = await response.blob();
    const mimeType = blob.type || this.guessMimeType(pathValue);
    const extension = this.guessExtension(pathValue, mimeType);
    return new File([blob], `${baseName}_${Date.now()}.${extension}`, { type: mimeType });
  }

  private guessExtension(pathValue: string, mimeType: string): string {
    const fromPath = String(pathValue || '').split('?')[0].split('.').pop()?.toLowerCase();
    if (fromPath && /^[a-z0-9]+$/.test(fromPath)) {
      return fromPath;
    }
    if (mimeType.includes('webm')) return 'webm';
    if (mimeType.includes('quicktime')) return 'mov';
    if (mimeType.includes('3gpp')) return '3gp';
    return 'mp4';
  }

  private guessMimeType(pathValue: string): string {
    const extension = String(pathValue || '').split('?')[0].split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'webm':
        return 'video/webm';
      case 'mov':
        return 'video/quicktime';
      case 'm4v':
        return 'video/x-m4v';
      case '3gp':
      case '3gpp':
        return 'video/3gpp';
      case 'mkv':
        return 'video/x-matroska';
      case 'avi':
        return 'video/x-msvideo';
      default:
        return 'video/mp4';
    }
  }

  resetAll(): void {
    this.mediaFile = null;
    this.description = '';
    this.contentCategory = '';
    this.previewUrl = null;
    this.mediaType = null;
    this.orderEnabled = false;
    this.linkedFoodId = '';
    this.uploadedVideo = null;
    this.isSuccessModalOpen = false;
    this.visibility = 'public';
    this.selectedFilter = 'none';
    this.step = 'capture';
    this.startPreview();
  }
}
