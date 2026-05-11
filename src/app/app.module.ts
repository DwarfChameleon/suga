import { APP_INITIALIZER, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';
import { IonicModule, IonicRouteStrategy } from '@ionic/angular';
import { LoginModalComponent } from './login-modal/login-modal.component';
import { LoginPageModule } from './login/login.module';
import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import { ChefRegistrationComponent } from './chef-registration/chef-registration.component';
import {FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule ,HTTP_INTERCEPTORS } from '@angular/common/http';
import { ConsumerRegistrationComponent } from './consumer-registration/consumer-registration.component';
import { LoaderComponent } from './loader/loader.component';
import { ChefComponent } from './components/chef/chef.component';
import { ConsumerComponent } from './components/consumer/consumer.component';
import { AuthInterceptor } from './helpers/auth.interceptor';
import { FoodRegistrationComponent } from './components/food-registration/food-registration.component';
import { ExploreComponent } from './components/explore/explore.component';
import { UserService } from './services/user.service';
import { UnauthorizedComponent } from './components/unauthorized/unauthorized.component';
import { FoodRegSuccessComponent } from './components/food-reg-success/food-reg-success.component';
import { BackButtonComponent } from './components/back-button/back-button.component';
import { FoodstoryComponent } from './components/foodstory/foodstory.component';
import { StoryComponent } from './components/story/story.component';
import { DraggableDirective } from './draggable.directive';
import { ProfileModalComponent } from './components/profile-modal/profile-modal.component';
import { ProfileUpdateComponent } from './components/profile-update/profile-update.component';
import { FoodProfileComponent } from './components/food-profile/food-profile.component';
import { OrderModalComponent } from './components/order-modal/order-modal.component';
import { OrderInfoComponent } from './components/order-info/order-info.component';
import { ChefOrdersComponent } from './components/chef-orders/chef-orders.component';
import { MediaCapture } from '@awesome-cordova-plugins/media-capture/ngx';
import { NotificationsComponent } from './components/notifications/notifications.component';
import { SuggestedChefsComponent } from './components/suggested-chefs/suggested-chefs.component';
import { CategoryModalComponent } from './components/category-modal/category-modal.component';
import { SearchComponent } from './components/search/search.component';
import { WalletComponent } from './components/wallet/wallet.component';
import { PaymentModalComponent } from './components/payment-modal/payment-modal.component';
import { GoogleSigninComponent } from './google/google-signin/google-signin.component';
import { CartComponent } from './components/cart/cart.component';
import { OrderHistoryComponent } from './components/order-history/order-history.component';
import { EditProfileComponent } from './components/edit-profile/edit-profile.component';
import { DispatchRegistrationComponent } from './dispatch-registration/dispatch-registration.component';
import { DispatchComponent } from './components/dispatch/dispatch.component';
import { RewardsComponent } from './components/rewards/rewards.component';
import { LogsComponent } from './components/logs/logs.component';
import { ProfileCompletenessCardComponent } from './components/profile-completeness-card/profile-completeness-card.component';
import { LiveOrderMapComponent } from './components/live-order-map/live-order-map.component';
import { OrderRatingComponent } from './components/order-rating/order-rating.component';
import { DispatchProfileComponent } from './components/dispatch-profile/dispatch-profile.component';
import { AdSlotComponent } from './components/ad-slot/ad-slot.component';
import { MoneyPipe } from './pipes/money.pipe';
import { ErrorHandler } from '@angular/core';
import { GlobalErrorHandler } from './services/global-error-handler';
import { ErrorLoggingInterceptor } from './services/error-logging.interceptor';
import { AddressDataService } from './services/address-data.service';
import { AdConfigService } from './services/ad-config.service';

export function preloadAddressCatalog(addressDataService: AddressDataService): () => Promise<void> {
  return () => addressDataService.warmCatalog();
}

export function preloadAdConfig(adConfigService: AdConfigService): () => Promise<void> {
  return () => adConfigService.warmConfig();
}

@NgModule({
  declarations: [AppComponent,ExploreComponent,FoodProfileComponent,OrderModalComponent,ChefOrdersComponent,OrderInfoComponent,ProfileUpdateComponent,ProfileModalComponent,StoryComponent,FoodstoryComponent,BackButtonComponent,LoaderComponent,FoodRegistrationComponent,FoodRegSuccessComponent,ChefComponent,ConsumerComponent,DispatchComponent,DispatchProfileComponent,LoginModalComponent,ChefRegistrationComponent,ConsumerRegistrationComponent,DispatchRegistrationComponent,UnauthorizedComponent, NotificationsComponent, SuggestedChefsComponent, CategoryModalComponent, SearchComponent, WalletComponent, PaymentModalComponent, DraggableDirective, GoogleSigninComponent, CartComponent, OrderHistoryComponent, EditProfileComponent, RewardsComponent, LogsComponent, ProfileCompletenessCardComponent, LiveOrderMapComponent, OrderRatingComponent, AdSlotComponent, MoneyPipe],
  imports: [BrowserModule, HttpClientModule, FormsModule, IonicModule.forRoot(), LoginPageModule, AppRoutingModule, ReactiveFormsModule],

  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    UserService,
    {
      provide: APP_INITIALIZER,
      useFactory: preloadAddressCatalog,
      deps: [AddressDataService],
      multi: true
    },
    {
      provide: APP_INITIALIZER,
      useFactory: preloadAdConfig,
      deps: [AdConfigService],
      multi: true
    },
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: ErrorLoggingInterceptor, multi: true },
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    MediaCapture
  ],
  bootstrap: [AppComponent],
 
 
})
export class AppModule {}
