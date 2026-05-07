import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from 'src/environments/environment';

export interface AdPlacementRule {
  enabled: boolean;
  type: 'banner' | 'native' | 'interstitial' | 'rewarded';
  afterEveryItems?: number;
  minConsumedItems?: number;
}

export interface AdConfig {
  version: number;
  enabled: boolean;
  provider: 'admob' | string;
  consentRequired: boolean;
  controls: {
    allowAppOpenAds: boolean;
    allowBannerAds: boolean;
    allowInterstitialAds: boolean;
    allowRewardedAds: boolean;
    allowNativeFeedAds: boolean;
    quietHoursEnabled: boolean;
  };
  policy: {
    neverInterruptCriticalFlows: boolean;
    disallowAdsDuringCheckout: boolean;
    disallowAdsDuringRegistration: boolean;
    disallowAdsDuringLogin: boolean;
    disallowAdsDuringWalletActions: boolean;
    disallowAdsDuringUpload: boolean;
    disallowAdsDuringMapNavigation: boolean;
    disallowAdsDuringLiveOrderTracking: boolean;
    disallowAdsDuringChatLikeRealtimeFlows: boolean;
    minSecondsBetweenInterstitials: number;
    minStoryItemsBeforeInterstitial: number;
    maxAdsPerSession: number;
  };
  placements: Record<string, AdPlacementRule>;
  network: Record<string, unknown>;
}

const defaultConfig: AdConfig = {
  version: 1,
  enabled: false,
  provider: 'admob',
  consentRequired: true,
  controls: {
    allowAppOpenAds: false,
    allowBannerAds: false,
    allowInterstitialAds: false,
    allowRewardedAds: false,
    allowNativeFeedAds: false,
    quietHoursEnabled: false
  },
  policy: {
    neverInterruptCriticalFlows: true,
    disallowAdsDuringCheckout: true,
    disallowAdsDuringRegistration: true,
    disallowAdsDuringLogin: true,
    disallowAdsDuringWalletActions: true,
    disallowAdsDuringUpload: true,
    disallowAdsDuringMapNavigation: true,
    disallowAdsDuringLiveOrderTracking: true,
    disallowAdsDuringChatLikeRealtimeFlows: true,
    minSecondsBetweenInterstitials: 180,
    minStoryItemsBeforeInterstitial: 8,
    maxAdsPerSession: 4
  },
  placements: {},
  network: {}
};

@Injectable({
  providedIn: 'root'
})
export class AdConfigService {
  private config: AdConfig = defaultConfig;
  private warmPromise: Promise<void> | null = null;

  constructor(private readonly http: HttpClient) {}

  async warmConfig(forceRefresh = false): Promise<void> {
    if (this.warmPromise && !forceRefresh) {
      return this.warmPromise;
    }

    this.warmPromise = this.fetchConfig();
    await this.warmPromise;
  }

  private async fetchConfig(): Promise<void> {
    try {
      const response = await firstValueFrom(this.http.get<{ ok: boolean; config?: AdConfig }>(`${environment.apiUrl}/ads/config`));
      if (response?.config) {
        this.config = response.config;
        return;
      }
      this.config = defaultConfig;
    } catch (_error) {
      this.config = defaultConfig;
    } finally {
      this.warmPromise = null;
    }
  }

  getConfig(): AdConfig {
    return this.config;
  }

  canShowPlacement(placementKey: string, context: {
    isCriticalFlow?: boolean;
    sessionAdsShown?: number;
    secondsSinceInterstitial?: number;
    consumedStoryItems?: number;
  } = {}): boolean {
    const placement = this.config.placements[placementKey];
    if (!this.config.enabled || !placement?.enabled) {
      return false;
    }
    if (context.isCriticalFlow && this.config.policy.neverInterruptCriticalFlows) {
      return false;
    }
    if ((context.sessionAdsShown || 0) >= this.config.policy.maxAdsPerSession) {
      return false;
    }
    if (placement.type === 'interstitial') {
      if ((context.secondsSinceInterstitial || 0) < this.config.policy.minSecondsBetweenInterstitials) {
        return false;
      }
      if ((context.consumedStoryItems || 0) < (placement.minConsumedItems || this.config.policy.minStoryItemsBeforeInterstitial)) {
        return false;
      }
    }
    return true;
  }
}
