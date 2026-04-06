import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { LoginModalComponent } from '../login-modal/login-modal.component';
import { FolderPage } from '../folder/folder.page';

import { LoginPage } from './login.page';
const routes: Routes = [
  {
    path: '',
    component: FolderPage
  },
  {path:'login-Modal',
  component: LoginModalComponent
},
  {
    path:'loginPage',
    component: LoginPage
  },
  {
    path:'folderPage',
    component: FolderPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class LoginPageRoutingModule {}
