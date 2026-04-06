import { AfterViewInit, Component, ElementRef, Input, OnChanges, OnDestroy, SimpleChanges, ViewChild } from '@angular/core';
import * as L from 'leaflet';
import { MapService } from 'src/app/services/map.service';

@Component({
  selector: 'app-live-order-map',
  templateUrl: './live-order-map.component.html',
  styleUrls: ['./live-order-map.component.scss']
})
export class LiveOrderMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() order: any;
  @Input() mode: 'consumer' | 'chef' | 'dispatch' = 'consumer';
  @ViewChild('mapContainer') mapContainer?: ElementRef<HTMLDivElement>;

  private map?: L.Map;
  private markers: L.LayerGroup = L.layerGroup();
  private routeLine?: L.Polyline;
  private loadingRoute = false;
  private movingMarker?: L.Marker;
  private moveTimer?: ReturnType<typeof setInterval>;
  private routeCoords: L.LatLngExpression[] = [];

  constructor(private readonly mapService: MapService) {}

  ngAfterViewInit(): void {
    this.initMap();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['order'] && this.map) {
      this.renderMarkers();
    }
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
    }
    if (this.moveTimer) {
      clearInterval(this.moveTimer);
    }
  }

  private initMap(): void {
    if (!this.mapContainer?.nativeElement || this.map) return;
    (L.Icon.Default as any).mergeOptions({
      iconRetinaUrl: 'assets/leaflet/marker-icon-2x.png',
      iconUrl: 'assets/leaflet/marker-icon.png',
      shadowUrl: 'assets/leaflet/marker-shadow.png'
    });
    this.map = L.map(this.mapContainer.nativeElement, {
      zoomControl: true,
      attributionControl: false
    }).setView([6.5244, 3.3792], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(this.map);

    this.markers.addTo(this.map);
    this.renderMarkers();
  }

  private renderMarkers(): void {
    if (!this.map || !this.order) return;

    this.markers.clearLayers();
    if (this.routeLine) {
      this.routeLine.remove();
    }
    if (this.movingMarker) {
      this.movingMarker.remove();
    }
    if (this.moveTimer) {
      clearInterval(this.moveTimer);
    }

    const points: L.LatLngExpression[] = [];
    const delivery = this.getCoords(this.order.deliveryLat, this.order.deliveryLng);
    const rider = this.getCoords(this.order.dispatchRiderLocation?.lat, this.order.dispatchRiderLocation?.lng);
    const chef = this.getCoords(this.order.chefLocation?.lat, this.order.chefLocation?.lng);

    if (chef) {
      points.push(chef);
      L.marker(chef, { title: 'Chef' }).addTo(this.markers);
    }
    if (rider) {
      points.push(rider);
      L.marker(rider, { title: 'Dispatch' }).addTo(this.markers);
    }
    if (delivery) {
      points.push(delivery);
      L.marker(delivery, { title: 'Delivery' }).addTo(this.markers);
    }

    if (points.length >= 1) {
      const viewTarget = points[0];
      this.map.setView(viewTarget, 13);
    }

    this.loadRoute(chef, rider, delivery);
  }

  private loadRoute(
    chef: L.LatLngExpression | null,
    rider: L.LatLngExpression | null,
    delivery: L.LatLngExpression | null
  ): void {
    if (!this.map || this.loadingRoute) return;
    const routePoints: Array<[number, number]> = [];

    const riderPoint = rider ? (rider as [number, number]) : null;
    const chefPoint = chef ? (chef as [number, number]) : null;
    const deliveryPoint = delivery ? (delivery as [number, number]) : null;

    if (this.mode === 'dispatch' && riderPoint && chefPoint && deliveryPoint) {
      routePoints.push(riderPoint, chefPoint, deliveryPoint);
    } else if (riderPoint && deliveryPoint) {
      routePoints.push(riderPoint, deliveryPoint);
    } else if (chefPoint && deliveryPoint) {
      routePoints.push(chefPoint, deliveryPoint);
    }

    if (routePoints.length < 2) {
      return;
    }

    this.loadingRoute = true;
    this.mapService.getRoute(routePoints).subscribe({
      next: (res) => {
        this.loadingRoute = false;
        const coords = res?.geometry?.coordinates || [];
        if (!coords.length || !this.map) return;
        const latlngs = coords.map((c) => [c[1], c[0]]) as L.LatLngExpression[];
        this.routeCoords = latlngs;
        this.routeLine = L.polyline(latlngs, { color: '#2563eb', weight: 4, opacity: 0.85 }).addTo(this.map);
        this.map.fitBounds(this.routeLine.getBounds(), { padding: [24, 24] });
        this.startRouteAnimation();
      },
      error: () => {
        this.loadingRoute = false;
      }
    });
  }

  private startRouteAnimation(): void {
    if (!this.map || this.routeCoords.length < 2) return;
    const start = this.routeCoords[0];
    this.movingMarker = L.marker(start, { title: 'Live' }).addTo(this.map);
    let index = 0;
    this.moveTimer = setInterval(() => {
      if (!this.movingMarker || !this.routeCoords.length) return;
      index = (index + 1) % this.routeCoords.length;
      this.movingMarker.setLatLng(this.routeCoords[index]);
    }, 1500);
  }

  private getCoords(lat: any, lng: any): L.LatLngExpression | null {
    const latitude = Number(lat);
    const longitude = Number(lng);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return [latitude, longitude];
  }
}
