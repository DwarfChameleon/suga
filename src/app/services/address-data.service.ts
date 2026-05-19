import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { City, Country, State } from 'country-state-city';
import { firstValueFrom, of } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { LOCATION_OVERRIDES } from '../data/location-overrides';

export type AddressFieldKey = 'region' | 'state' | 'city' | 'suburb' | 'localGovernment' | 'street';
export type AddressFieldType = 'select' | 'text';

export interface AddressFieldConfig {
  key: AddressFieldKey;
  label: string;
  type: AddressFieldType;
  required?: boolean;
}

interface CountryProfile {
  isoCode: string;
  dialCode?: string;
  fields: AddressFieldConfig[];
}

interface AddressCatalogPayload {
  version: number;
  updatedAt: string;
  profiles: Record<string, CountryProfile>;
  coverage: Record<string, { states: Record<string, Array<{ name: string; suburbs?: string[] }>> }>;
}

@Injectable({
  providedIn: 'root'
})
export class AddressDataService {
  private static readonly CACHE_KEY = 'suga.address.catalog.v5';
  private readonly fallbackProfiles: Record<string, CountryProfile> = {
    Nigeria: {
      isoCode: 'NG',
      dialCode: '+234',
      fields: [
        { key: 'state', label: 'State', type: 'select' },
        { key: 'city', label: 'Town or City', type: 'select' },
        { key: 'suburb', label: 'Area / Neighborhood (optional)', type: 'select', required: false }
      ]
    },
    'United States': {
      isoCode: 'US',
      dialCode: '+1',
      fields: [
        { key: 'state', label: 'State', type: 'select' },
        { key: 'city', label: 'City', type: 'select' },
        { key: 'suburb', label: 'Suburb (optional)', type: 'text', required: false },
        { key: 'street', label: 'Street (optional)', type: 'text', required: false }
      ]
    },
    'United Kingdom': {
      isoCode: 'GB',
      dialCode: '+44',
      fields: [
        { key: 'state', label: 'County / Nation', type: 'select' },
        { key: 'city', label: 'City', type: 'select' },
        { key: 'suburb', label: 'District / Suburb (optional)', type: 'text', required: false },
        { key: 'street', label: 'Street (optional)', type: 'text', required: false }
      ]
    },
    'South Africa': {
      isoCode: 'ZA',
      dialCode: '+27',
      fields: [
        { key: 'state', label: 'Province', type: 'select' },
        { key: 'city', label: 'City', type: 'select' },
        { key: 'suburb', label: 'Suburb (optional)', type: 'text', required: false },
        { key: 'street', label: 'Street (optional)', type: 'text', required: false }
      ]
    },
    Ghana: {
      isoCode: 'GH',
      dialCode: '+233',
      fields: [
        { key: 'region', label: 'Region', type: 'select' },
        { key: 'city', label: 'Town or City', type: 'select' }
      ]
    },
    Kenya: {
      isoCode: 'KE',
      dialCode: '+254',
      fields: [
        { key: 'state', label: 'County', type: 'select' },
        { key: 'city', label: 'Town or City', type: 'select' },
        { key: 'suburb', label: 'Suburb (optional)', type: 'text', required: false }
      ]
    },
    France: {
      isoCode: 'FR',
      dialCode: '+33',
      fields: [
        { key: 'region', label: 'Region', type: 'select' },
        { key: 'city', label: 'City', type: 'select' },
        { key: 'street', label: 'Street (optional)', type: 'text', required: false }
      ]
    },
    Italy: {
      isoCode: 'IT',
      dialCode: '+39',
      fields: [
        { key: 'region', label: 'Region', type: 'select' },
        { key: 'city', label: 'City', type: 'select' },
        { key: 'street', label: 'Street (optional)', type: 'text', required: false }
      ]
    },
    Zimbabwe: {
      isoCode: 'ZW',
      dialCode: '+263',
      fields: [
        { key: 'state', label: 'Province / City', type: 'select' },
        { key: 'city', label: 'City or Town', type: 'select' },
        { key: 'suburb', label: 'Suburb / Area (optional)', type: 'select', required: false }
      ]
    },
    Malawi: {
      isoCode: 'MW',
      dialCode: '+265',
      fields: [
        { key: 'region', label: 'Region', type: 'select' },
        { key: 'city', label: 'City or Town', type: 'select' },
        { key: 'suburb', label: 'Area / Neighborhood (optional)', type: 'select', required: false }
      ]
    }
  };
  private profiles: Record<string, CountryProfile> = { ...this.fallbackProfiles };
  private coverage: AddressCatalogPayload['coverage'] = LOCATION_OVERRIDES;
  private catalogBootPromise?: Promise<void>;

  constructor(private readonly http: HttpClient) {
    this.loadFromCache();
  }

  getCountries(): string[] {
    return Object.keys(this.profiles).sort((a, b) => a.localeCompare(b));
  }

  getFieldConfig(country: string): AddressFieldConfig[] {
    return this.profiles[country]?.fields || [];
  }

  async warmCatalog(force = false): Promise<void> {
    if (!force && this.catalogBootPromise) {
      return this.catalogBootPromise;
    }

    this.catalogBootPromise = firstValueFrom(
      this.http.get<AddressCatalogPayload>(`${environment.apiUrl}/locations/catalog`).pipe(
        timeout(2500),
        catchError(() => of(null))
      )
    ).then((payload) => {
      if (payload?.profiles) {
        this.applyCatalog(payload);
      }
    }).finally(() => {
      if (force) {
        this.catalogBootPromise = undefined;
      }
    });

    return this.catalogBootPromise;
  }


  getDialCode(country: string): string {
    const explicit = String(this.profiles[country]?.dialCode || '').trim();
    if (explicit) {
      return explicit;
    }

    const iso = this.profiles[country]?.isoCode;
    if (!iso) {
      return '';
    }

    const fromLibrary = Country.getAllCountries().find((entry) => entry.isoCode === iso)?.phonecode || '';
    return fromLibrary ? `+${fromLibrary}` : '';
  }

  getRegions(country: string): string[] {
    const iso = this.profiles[country]?.isoCode;
    if (!iso) return [];
    return this.mergeWithOverrides(this.getOverrideStateNames(country), State.getStatesOfCountry(iso).map((s) => s.name));
  }

  getStates(country: string): string[] {
    const iso = this.profiles[country]?.isoCode;
    if (!iso) return [];
    const libraryStates = State.getStatesOfCountry(iso).map((s) => s.name);
    const overrideStates = this.getOverrideStateNames(country);
    return this.mergeWithOverrides(overrideStates, libraryStates);
  }

  getCities(country: string, stateOrRegion: string): string[] {
    const iso = this.profiles[country]?.isoCode;
    if (!iso || !stateOrRegion) return [];

    const overrideCities = (this.coverage[country]?.states?.[stateOrRegion] || []).map((entry) => entry.name);

    const state = State.getStatesOfCountry(iso).find((s) => s.name === stateOrRegion);
    const libraryCities = state
      ? City.getCitiesOfState(iso, state.isoCode).map((c) => c.name)
      : [];

    return this.mergeWithOverrides(overrideCities, libraryCities);
  }

  getSuburbs(country: string, stateOrRegion: string, city: string): string[] {
    if (!country || !stateOrRegion || !city) return [];
    const suburbs = this.coverage[country]?.states?.[stateOrRegion]
      ?.find((entry) => entry.name === city)
      ?.suburbs || [];
    return this.uniqueInOrder(suburbs);
  }

  getLocalGovernments(_country: string, _stateOrRegion: string): string[] {
    return [];
  }

  private applyCatalog(payload: AddressCatalogPayload): void {
    this.profiles = Object.keys(payload.profiles || {}).length
      ? { ...this.fallbackProfiles, ...payload.profiles }
      : { ...this.fallbackProfiles };
    this.coverage = Object.keys(payload.coverage || {}).length
      ? { ...LOCATION_OVERRIDES, ...payload.coverage }
      : LOCATION_OVERRIDES;
    this.writeCache(payload);
  }

  private loadFromCache(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(AddressDataService.CACHE_KEY);
      if (!raw) return;
      const cached = JSON.parse(raw) as AddressCatalogPayload;
      if (cached?.profiles) {
        this.profiles = Object.keys(cached.profiles).length ? { ...this.fallbackProfiles, ...cached.profiles } : { ...this.fallbackProfiles };
      }
      if (cached?.coverage) {
        this.coverage = Object.keys(cached.coverage).length ? { ...LOCATION_OVERRIDES, ...cached.coverage } : LOCATION_OVERRIDES;
      }
    } catch {
      // Ignore invalid cache and continue with bundled fallback data.
    }
  }

  private writeCache(payload: AddressCatalogPayload): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(AddressDataService.CACHE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage errors so registration flow still works.
    }
  }

  private getOverrideStateNames(country: string): string[] {
    return Object.keys(this.coverage[country]?.states || {});
  }

  private mergeWithOverrides(priorityValues: string[], fallbackValues: string[]): string[] {
    const fallbackOnly = fallbackValues
      .filter((value) => !priorityValues.includes(value))
      .sort((a, b) => a.localeCompare(b));
    return this.uniqueInOrder([...priorityValues, ...fallbackOnly]);
  }

  private uniqueInOrder(values: string[]): string[] {
    const seen = new Set<string>();
    const output: string[] = [];
    for (const value of values) {
      if (!value || seen.has(value)) {
        continue;
      }
      seen.add(value);
      output.push(value);
    }
    return output;
  }
}
