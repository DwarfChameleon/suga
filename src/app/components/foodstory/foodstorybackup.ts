import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { MediaCapture, MediaFile, CaptureError } from '@awesome-cordova-plugins/media-capture/ngx';
@Component({
  selector: 'app-foodstory',
  templateUrl: './foodstory.component.html',
  styleUrls: ['./foodstory.component.scss'],
})
export class FoodstoryComponent  implements OnInit {
  mediaFile: File | null = null;
  description: string = '';
  uploadStatus: string = '';
  previewUrl: SafeUrl | null = null;
  mediaType: 'video' | 'image' | null = null;
  private apiUrl = `${environment.apiUrl}`;

  constructor(
    private http: HttpClient,
    private sanitizer: DomSanitizer,
    private mediaCapture: MediaCapture
  ) {}


ngOnInit() {}

  handleFileInput(event: Event) {
    const target = event.target as HTMLInputElement;
    if (!target.files || target.files.length === 0) return;

    const file = target.files[0];
    this.mediaFile = file;
    this.mediaType = file.type.startsWith('image') ? 'image' : file.type.startsWith('video') ? 'video' : null;
    // create preview
    const url = URL.createObjectURL(file);
    this.previewUrl = this.sanitizer.bypassSecurityTrustUrl(url);
  }

  handleDescriptionInput(event: Event) {
    const target = event.target as HTMLInputElement;
    this.description = target.value;
  }

  async uploadMedia() {
    if (!this.mediaFile) {
      this.uploadStatus = 'Please select a media file first.';
      return;
    }

    const formData = new FormData();
    // backend expects 'file' key (adjust if your backend uses 'video' or 'image')
    formData.append('file', this.mediaFile, this.mediaFile.name);
    formData.append('description', this.description || '');
    formData.append('type', this.mediaType || '');

    this.uploadStatus = 'Uploading...';
    try {
      const response = await this.http.post<any>(`${this.apiUrl}/upload-media`, formData).toPromise();
      this.uploadStatus = response?.message || 'Upload successful';
    } catch (error) {
      console.error('Error uploading media:', error);
      this.uploadStatus = 'Error uploading media';
    }
  }

  // optional: capture media using Cordova plugin (for devices)
  captureVideo() {
    this.mediaCapture.captureVideo()
      .then((result: any) => {
        if (!Array.isArray(result) || result.length === 0) return;
        const mf: any = result[0];
        this.uploadStatus = 'Captured video - please tap Upload to send';
        this.mediaType = 'video';
        this.previewUrl = this.sanitizer.bypassSecurityTrustUrl(mf.fullPath || mf.localURL || mf.fullPath);
      })
      .catch((err: any) => {
        console.error('Capture error', err);
      });
  }
}

  
const html=`<ion-content>
  <div class="foodStoryBg">
  <div class="topContainer">
  <app-back-button></app-back-button>
<div>
  <div class="instructions">
  <h2>Update <br>Your Food Story </h2>
</div>
<br>
<p>{{ uploadStatus }}</p>
</div>
<div class="inputEvents glass">
  <!-- allow camera capture on supported devices; accept both images and videos -->
  <input type="file" (change)="handleFileInput($event)" accept="image/*,video/*" capture>
  <input type="text" placeholder="Description" [(ngModel)]="description">
  <div *ngIf="previewUrl" class="preview">
    <ng-container *ngIf="mediaType === 'image'">
      <img [src]="previewUrl" alt="preview" class="img-fluid">
    </ng-container>
    <ng-container *ngIf="mediaType === 'video'">
      <video [src]="previewUrl" controls class="img-fluid"></video>
    </ng-container>
  </div>
  <button (click)="uploadMedia()">Upload</button>
</div>
 
</div>
</div>
</ion-content>`