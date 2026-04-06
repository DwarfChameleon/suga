import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class LoaderService {
  public loading = false;

  constructor() {}

  showLoader() {
    this.loading = true;
    console.log('Loader shown'); // Debug log
  }

  hideLoader() {
    this.loading = false;
    console.log('Loader hidden'); // Debug log
  }
}
