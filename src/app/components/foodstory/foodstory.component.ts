import { Component, OnInit, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { MediaCapture } from '@awesome-cordova-plugins/media-capture/ngx';
import { UiFeedbackService } from 'src/app/services/ui-feedback.service';
import { LoadingService } from 'src/app/services/loading.service';
import { TokenStorageService } from 'src/app/services/token-storage.service';
import { FoodService } from 'src/app/services/food.service';
import { Food } from 'src/app/interface/food';

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
  myDishes: Food[] = [];
  step: StoryStep = 'capture';

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
    private foodService: FoodService
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
    formData.append('orderEnabled', String(this.orderEnabled));
    formData.append('visibility', this.visibility);
    formData.append('filterPreset', this.selectedFilter);
    if (this.orderEnabled && this.linkedFoodId) {
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
      this.uiFeedback.success('Story posted successfully.');
      this.resetAll();
      await this.loadingService.hide();
    } catch (error) {
      console.error('Error uploading media:', error);
      this.uploadStatus = 'Error uploading media';
      this.uiFeedback.error(this.uploadStatus);
      await this.loadingService.hide();
    }
  }

  captureVideo() {
    this.mediaCapture.captureVideo()
      .then((result: any) => {
        if (!Array.isArray(result) || result.length === 0) return;
        const mf: any = result[0];
        this.uploadStatus = 'Captured video - proceed to details';
        this.mediaType = 'video';
        this.previewUrl = this.sanitizer.bypassSecurityTrustUrl(mf.fullPath || mf.localURL || mf.fullPath);
        this.step = 'review';
      })
      .catch((err: any) => {
        console.error('Capture error', err);
        this.uiFeedback.error('Capture error. Please try again.');
      });
  }

  private resetAll(): void {
    this.mediaFile = null;
    this.description = '';
    this.contentCategory = '';
    this.previewUrl = null;
    this.mediaType = null;
    this.orderEnabled = false;
    this.linkedFoodId = '';
    this.visibility = 'public';
    this.selectedFilter = 'none';
    this.step = 'capture';
    this.startPreview();
  }
}
