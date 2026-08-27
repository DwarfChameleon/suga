import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AdConfigService } from 'src/app/services/ad-config.service';
import { AdMobDisplayResult, AdMobService } from 'src/app/services/admob.service';
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
  adMobVisible = false;
  adMobStatus: AdMobDisplayResult | '' = '';
  private readonly handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      void this.loadAd(true);
    }
  };

  constructor(
    private readonly adConfig: AdConfigService,
    private readonly adMob: AdMobService,
    private readonly promotedAds: PromotedAdService,
    private readonly router: Router
  ) {}

  async ngOnInit(): Promise<void> {
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    await this.loadAd(true);
  }

  ngOnDestroy(): void {
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    if (this.adMobVisible) {
      void this.adMob.hideBanner();
    }
  }

  private async loadAd(forceRefreshConfig = false): Promise<void> {
    await this.adConfig.warmConfig(forceRefreshConfig);

    if (!this.adConfig.canShowPlacement(this.placement, { isCriticalFlow: this.isCriticalFlow })) {
      this.ad = null;
      this.visible = false;
      this.adMobVisible = false;
      this.adMobStatus = '';
      return;
    }

    this.promotedAds.getPlacementAd(this.placement).subscribe((ad) => {
      this.ad = ad;
      this.visible = !!ad;
      if (ad) {
        this.adMobVisible = false;
        this.adMobStatus = '';
        return;
      }
      void this.showAdMobFallback();
    });
  }

  private async showAdMobFallback(): Promise<void> {
    const config = this.adConfig.getConfig();
    if (String(config.provider || '').toLowerCase() !== 'admob') {
      this.adMobVisible = false;
      this.adMobStatus = '';
      return;
    }

    const placement = this.adConfig.getPlacement(this.placement);
    const result = await this.adMob.showFallbackAd(placement, this.adConfig.getAdMobNetworkConfig());
    this.adMobStatus = result;
    this.adMobVisible = result === 'shown';
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
