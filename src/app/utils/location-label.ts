export interface LocationLike {
  country?: string;
  state?: string;
  region?: string;
  city?: string;
  suburb?: string;
  neighborhood?: string;
  neighbourhood?: string;
  localGovernment?: string;
  street?: string;
  homeAddress?: string;
  address?: string;
  restaurantAddress?: string;
  restaurantLocation?: string;
  locationInfo?: string;
}

export function buildLocationLabel(source: LocationLike | undefined | null): string {
  if (!source) return '';
  const parts = [
    source.suburb || source.neighborhood || source.neighbourhood,
    source.city,
    source.localGovernment,
    source.state || source.region,
    source.country
  ];
  const unique = parts
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .filter((part, index, list) => list.findIndex((item) => item.toLowerCase() === part.toLowerCase()) === index);

  return unique.join(' · ');
}

export function buildAddressLabel(source: LocationLike | undefined | null): string {
  if (!source) return '';
  return String(
    source.restaurantAddress
      || source.restaurantLocation
      || source.homeAddress
      || source.address
      || source.street
      || source.locationInfo
      || ''
  ).trim();
}
