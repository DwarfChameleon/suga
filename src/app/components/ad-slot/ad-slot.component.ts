import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AdConfigService } from 'src/app/services/ad-config.service';
import { PromotedAd, PromotedAdService } from 'src/app/services/promoted-ad.service';

@Component({
  selector: 'app-ad-slot',
  templateUrl: './ad-slot.component.html',
  styleUrls: ['./ad-slot.component.scss']
})
export class AdSlotComponent implements OnInit, OnDestroy {
  @Input() placement = '';
  @Input() label = 'Featured';
  @Input() isCriticalFlow = false;

  ad: PromotedAd | null = null;
  visible = false;
  private readonly handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      void this.loadAd(true);
    }
  };

  constructor(
    private readonly adConfig: AdConfigService,
    private readonly promotedAds: PromotedAdService,
    private readonly router: Router
  ) {}

  async ngOnInit(): Promise<void> {
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    await this.loadAd(true);
  }

  ngOnDestroy(): void {
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
  }

  private async loadAd(forceRefreshConfig = false): Promise<void> {
    await this.adConfig.warmConfig(forceRefreshConfig);

    if (!this.adConfig.canShowPlacement(this.placement, { isCriticalFlow: this.isCriticalFlow })) {
      this.ad = null;
      this.visible = false;
      return;
    }

    this.promotedAds.getPlacementAd(this.placement).subscribe((ad) => {
      this.ad = ad;
      this.visible = !!ad;
    });
  }

  openAd(): void {
    if (!this.ad?.targetUrl) return;
    const url = this.ad.targetUrl.trim();
    if (url.startsWith('/')) {
      this.router.navigateByUrl(url);
      return;
    }
    window.open(url, '_blank', 'noopener');
  }
}
