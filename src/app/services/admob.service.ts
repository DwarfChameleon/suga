import { Injectable } from '@angular/core';
import { AdMobNetworkConfig, AdPlacementRule } from './ad-config.service';

export type AdMobDisplayResult = 'shown' | 'unavailable' | 'missing-unit' | 'failed';

@Injectable({
  providedIn: 'root'
})
export class AdMobService {
  private initialized = false;

  async showFallbackAd(placement: AdPlacementRule | null, network: AdMobNetworkConfig): Promise<AdMobDisplayResult> {
    const adMob = this.getNativeAdMob();
    if (!adMob || !placement) return 'unavailable';

    const adId = this.getAdUnitId(placement.type, network);
    if (!adId) return 'missing-unit';

    try {
      await this.initialize(adMob, network);

      if (placement.type === 'interstitial' && typeof adMob.prepareInterstitial === 'function') {
        await adMob.prepareInterstitial({ adId, isTesting: !!network.testMode });
        await adMob.showInterstitial();
        return 'shown';
      }

      if (placement.type === 'rewarded' && typeof adMob.prepareRewardVideoAd === 'function') {
        await adMob.prepareRewardVideoAd({ adId, isTesting: !!network.testMode });
        await adMob.showRewardVideoAd();
        return 'shown';
      }

      if (typeof adMob.showBanner === 'function') {
        await adMob.showBanner({
          adId,
          adSize: 'BANNER',
          position: 'BOTTOM_CENTER',
          margin: 0,
          isTesting: !!network.testMode
        });
        return 'shown';
      }

      return 'unavailable';
    } catch (error) {
      console.warn('[AdMob] fallback ad failed', error);
      return 'failed';
    }
  }

  async hideBanner(): Promise<void> {
    const adMob = this.getNativeAdMob();
    if (adMob?.hideBanner) {
      try {
        await adMob.hideBanner();
      } catch {
        // Ignore banner cleanup failures.
      }
    }
  }

  private async initialize(adMob: any, network: AdMobNetworkConfig): Promise<void> {
    if (this.initialized || typeof adMob.initialize !== 'function') return;
    await adMob.initialize({
      requestTrackingAuthorization: false,
      initializeForTesting: !!network.testMode,
      testingDevices: network.testMode ? ['EMULATOR'] : []
    });
    this.initialized = true;
  }

  private getNativeAdMob(): any | null {
    const capacitor = (window as any)?.Capacitor;
    if (!capacitor?.isNativePlatform?.()) return null;
    return capacitor?.Plugins?.AdMob || null;
  }

  private getAdUnitId(type: AdPlacementRule['type'], network: AdMobNetworkConfig): string {
    if (type === 'interstitial') return String(network.interstitialUnitIdAndroid || '').trim();
    if (type === 'rewarded') return String(network.rewardedUnitIdAndroid || '').trim();
    if (type === 'native') {
      return String(network.nativeUnitIdAndroid || network.bannerUnitIdAndroid || '').trim();
    }
    return String(network.bannerUnitIdAndroid || '').trim();
  }
}
