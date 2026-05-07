import { Component, Input, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AdConfigService } from 'src/app/services/ad-config.service';
import { PromotedAd, PromotedAdService } from 'src/app/services/promoted-ad.service';

@Component({
  selector: 'app-ad-slot',
  templateUrl: './ad-slot.component.html',
  styleUrls: ['./ad-slot.component.scss']
})
export class AdSlotComponent implements OnInit {
  @Input() placement = '';
  @Input() label = 'Sponsored';
  @Input() isCriticalFlow = false;

  ad: PromotedAd | null = null;
  visible = false;

  constructor(
    private readonly adConfig: AdConfigService,
    private readonly promotedAds: PromotedAdService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    if (!this.adConfig.canShowPlacement(this.placement, { isCriticalFlow: this.isCriticalFlow })) {
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
