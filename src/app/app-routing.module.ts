import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { ExploreComponent } from './components/explore/explore.component';
import { ChefRegistrationComponent } from './chef-registration/chef-registration.component';
import { ConsumerRegistrationComponent } from './consumer-registration/consumer-registration.component';
import { LoaderComponent } from './loader/loader.component';
import { ChefComponent } from './components/chef/chef.component';
import { ConsumerComponent } from './components/consumer/consumer.component';
import { FoodRegistrationComponent } from './components/food-registration/food-registration.component';
import { AuthGuard } from './services/authguard.service';
import { UserRole } from './user-role.enum';
import { FolderPage } from './folder/folder.page';
import { AutoredirectguardService } from './services/autoredirectguard.service';
import { UnauthorizedComponent } from './components/unauthorized/unauthorized.component';
import { FoodRegSuccessComponent } from './components/food-reg-success/food-reg-success.component';
import { FoodstoryComponent } from './components/foodstory/foodstory.component';
import { StoryComponent } from './components/story/story.component';
import { ProfileUpdateComponent } from './components/profile-update/profile-update.component';
import { FoodProfileComponent } from './components/food-profile/food-profile.component';
import { ChefOrdersComponent } from './components/chef-orders/chef-orders.component';
import { NotificationsComponent } from './components/notifications/notifications.component';
import { SearchComponent } from './components/search/search.component';
import { WalletComponent } from './components/wallet/wallet.component';
import { CartComponent } from './components/cart/cart.component';
import { OrderHistoryComponent } from './components/order-history/order-history.component';
import { EditProfileComponent } from './components/edit-profile/edit-profile.component';
import { RewardsComponent } from './components/rewards/rewards.component';
import { DispatchRegistrationComponent } from './dispatch-registration/dispatch-registration.component';
import { DispatchComponent } from './components/dispatch/dispatch.component';
import { LogsComponent } from './components/logs/logs.component';
import { DispatchProfileComponent } from './components/dispatch-profile/dispatch-profile.component';
import { ChefDirectoryComponent } from './components/chef-directory/chef-directory.component';
const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'components/explore'
  },
  {
    path: 'components/explore',
    component: ExploreComponent
  },
  {
    path: 'folder/inbox',
    component: FolderPage,
    canActivate: [AutoredirectguardService],
  },
  {
    path: 'components/food-registration',
    component: FoodRegistrationComponent,
    canActivate: [AuthGuard],
    data: { expectedRoles: [UserRole.Chef] }
  },
  {
    path: 'components/food-reg-success',
    component: FoodRegSuccessComponent,
    canActivate: [AuthGuard],
    data: { expectedRoles: [UserRole.Chef] }
  },
  {
    path: 'components/chef',
    component: ChefComponent,
    canActivate: [AuthGuard],
    data: { expectedRoles: [UserRole.Chef] }
  },
  {
    path: 'components/chef-orders',
    component: ChefOrdersComponent,
    canActivate: [AuthGuard],
    data: { expectedRoles: [UserRole.Chef] }
  },
  {
    path: 'components/consumer',
    component: ConsumerComponent,
    canActivate: [AuthGuard],
    data: { expectedRoles: [UserRole.Consumer] }
  },
  {
    path: 'components/dispatch',
    component: DispatchComponent,
    canActivate: [AuthGuard],
    data: { expectedRoles: [UserRole.Dispatch] }
  },
  {
    path: 'components/dispatch-profile',
    component: DispatchProfileComponent,
    canActivate: [AuthGuard],
    data: { expectedRoles: [UserRole.Dispatch] }
  },
  {
    path:'components/foodstory',
    component:FoodstoryComponent,
    canActivate:[AuthGuard],
    data:{ expectedRoles: [UserRole.Chef] }
  },
  {
    path:'components/story',
    component:StoryComponent,
  },
  {
    path: 'loader',
    component: LoaderComponent
  },
  {
    path: 'consumer-registration',
    component: ConsumerRegistrationComponent
  },
  {
    path: 'dispatch-registration',
    component: DispatchRegistrationComponent
  },
  {
    path: 'chef-registration',
    component: ChefRegistrationComponent
  },
  {
    path: 'components/unauthorized',
    component: UnauthorizedComponent
  },
  {
    path:'components/profile-update',
    component:ProfileUpdateComponent,
    canActivate:[AuthGuard],
    data: { expectedRoles: [UserRole.Chef, UserRole.Consumer, UserRole.Dispatch] }
  },
  {
    path:'components/edit-profile',
    component:EditProfileComponent,
    canActivate:[AuthGuard],
    data: { expectedRoles: [UserRole.Chef, UserRole.Consumer, UserRole.Dispatch] }
  },
  {
    path:'components/food-profile',
    component:FoodProfileComponent,
  },
  {
    path: 'components/notifications',
    component: NotificationsComponent,
    canActivate: [AuthGuard],
    data: { expectedRoles: [UserRole.Chef, UserRole.Consumer, UserRole.Dispatch] }
  },
  {
    path: 'components/search',
    component: SearchComponent
  },
  {
    path: 'components/chefs',
    component: ChefDirectoryComponent
  },
  {
    path: 'components/wallet',
    component: WalletComponent,
    canActivate: [AuthGuard],
    data: { expectedRoles: [UserRole.Chef, UserRole.Consumer, UserRole.Dispatch] }
  },
  {
    path: 'components/cart',
    component: CartComponent,
    canActivate: [AuthGuard],
    data: { expectedRoles: [UserRole.Consumer] }
  },
  {
    path: 'components/order-history',
    component: OrderHistoryComponent,
    canActivate: [AuthGuard],
    data: { expectedRoles: [UserRole.Consumer] }
  },
  {
    path: 'components/rewards',
    component: RewardsComponent,
    canActivate: [AuthGuard],
    data: { expectedRoles: [UserRole.Chef, UserRole.Consumer, UserRole.Dispatch] }
  },
  {
    path: 'components/logs',
    component: LogsComponent,
    canActivate: [AuthGuard],
    data: { expectedRoles: [UserRole.Chef, UserRole.Consumer, UserRole.Dispatch] }
  },
  {
    path: 'folder/:id',
    loadChildren: () => import('./folder/folder.module').then(m => m.FolderPageModule)
  },
  {
    path: 'login',
    canActivate: [AutoredirectguardService],
    loadChildren: () => import('./login/login.module').then(m => m.LoginPageModule)
  },
  {
    path: 'registration',
    canActivate: [AutoredirectguardService],
    loadChildren: () => import('./registration/registration.module').then(m => m.RegistrationPageModule)
  },
  {
    path: 'forgot-password',
    loadChildren: () => import('./forgot-password/forgot-password.module').then(m => m.ForgotPasswordPageModule)
  },
  {
    path: 'success',
    loadChildren: () => import('./success/success.module').then(m => m.SuccessPageModule)
  }
];
@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule {}
