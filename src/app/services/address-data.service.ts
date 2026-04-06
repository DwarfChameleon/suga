import { Injectable } from '@angular/core';
import { City, State } from 'country-state-city';

export type AddressFieldKey = 'region' | 'state' | 'city' | 'suburb' | 'localGovernment' | 'street';
export type AddressFieldType = 'select' | 'text';

export interface AddressFieldConfig {
  key: AddressFieldKey;
  label: string;
  type: AddressFieldType;
}

interface CountryProfile {
  isoCode: string;
  fields: AddressFieldConfig[];
}

@Injectable({
  providedIn: 'root'
})
export class AddressDataService {
  private readonly profiles: Record<string, CountryProfile> = {
    Nigeria: {
      isoCode: 'NG',
      fields: [
        { key: 'state', label: 'State', type: 'select' },
        { key: 'localGovernment', label: 'Local Government', type: 'text' },
        { key: 'city', label: 'Town or City', type: 'select' }
      ]
    },
    'United States': {
      isoCode: 'US',
      fields: [
        { key: 'state', label: 'State', type: 'select' },
        { key: 'city', label: 'City', type: 'select' },
        { key: 'suburb', label: 'Suburb', type: 'text' },
        { key: 'street', label: 'Street', type: 'text' }
      ]
    },
    'United Kingdom': {
      isoCode: 'GB',
      fields: [
        { key: 'state', label: 'County / Nation', type: 'select' },
        { key: 'city', label: 'City', type: 'select' },
        { key: 'suburb', label: 'District / Suburb', type: 'text' },
        { key: 'street', label: 'Street', type: 'text' }
      ]
    },
    'South Africa': {
      isoCode: 'ZA',
      fields: [
        { key: 'state', label: 'Province', type: 'select' },
        { key: 'city', label: 'City', type: 'select' },
        { key: 'suburb', label: 'Suburb', type: 'text' },
        { key: 'street', label: 'Street', type: 'text' }
      ]
    },
    Ghana: {
      isoCode: 'GH',
      fields: [
        { key: 'region', label: 'Region', type: 'select' },
        { key: 'city', label: 'Town or City', type: 'select' },
        { key: 'localGovernment', label: 'District / Municipality', type: 'text' }
      ]
    },
    Kenya: {
      isoCode: 'KE',
      fields: [
        { key: 'state', label: 'County', type: 'select' },
        { key: 'city', label: 'Town or City', type: 'select' },
        { key: 'suburb', label: 'Suburb', type: 'text' }
      ]
    },
    France: {
      isoCode: 'FR',
      fields: [
        { key: 'region', label: 'Region', type: 'select' },
        { key: 'city', label: 'City', type: 'select' },
        { key: 'street', label: 'Street', type: 'text' }
      ]
    },
    Italy: {
      isoCode: 'IT',
      fields: [
        { key: 'region', label: 'Region', type: 'select' },
        { key: 'city', label: 'City', type: 'select' },
        { key: 'street', label: 'Street', type: 'text' }
      ]
    }
  };

  getCountries(): string[] {
    return Object.keys(this.profiles);
  }

  getFieldConfig(country: string): AddressFieldConfig[] {
    return this.profiles[country]?.fields || [];
  }

  getRegions(country: string): string[] {
    const iso = this.profiles[country]?.isoCode;
    if (!iso) return [];
    return this.uniqueSorted(State.getStatesOfCountry(iso).map((s) => s.name));
  }

  getStates(country: string): string[] {
    const iso = this.profiles[country]?.isoCode;
    if (!iso) return [];
    return this.uniqueSorted(State.getStatesOfCountry(iso).map((s) => s.name));
  }

  getCities(country: string, stateOrRegion: string): string[] {
    const iso = this.profiles[country]?.isoCode;
    if (!iso || !stateOrRegion) return [];

    const state = State.getStatesOfCountry(iso).find((s) => s.name === stateOrRegion);
    if (!state) return [];

    return this.uniqueSorted(
      City.getCitiesOfState(iso, state.isoCode).map((c) => c.name)
    );
  }

  getSuburbs(_country: string, _stateOrRegion: string): string[] {
    return [];
  }

  getLocalGovernments(_country: string, _stateOrRegion: string): string[] {
    return [];
  }

  private uniqueSorted(values: string[]): string[] {
    return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
  }
}
