import { Injectable } from '@angular/core';
import { TokenStorageService } from './token-storage.service';
import { UserInfo, UserDetails } from '../interface/user-details';
import { Observable, throwError, Subject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';

export interface UserSettings {
  username: string;
  email: string;
  roles: string[];
  phoneNumber?: string;
  homeAddress?: string;
  city?: string;
  country?: string;
  preferredCurrency?: string;
  isOnline: boolean;
  uiTheme: 'light' | 'dark';
  isPrivateChef: boolean;
  hasTransactionPin?: boolean;
  emailVerified?: boolean;
}

export interface EditableProfile {
  username: string;
  fullName?: string;
  email: string;
  roles: string[];
  phoneNumber?: string;
  homeAddress?: string;
  workAddress?: string;
  restaurantAddress?: string;
  city?: string;
  state?: string;
  region?: string;
  suburb?: string;
  localGovernment?: string;
  street?: string;
  country?: string;
  locationInfo?: string;
  profilePicture?: string;
  coverPicture?: string;
  uiTheme?: 'light' | 'dark';
  emailVerified?: boolean;
  emailVerifiedAt?: string | null;
  phoneVerification?: {
    idToken: string;
    uid: string;
    phoneNumber: string;
    verifiedAt: string;
  };
}

export interface FollowToggleResponse {
  following: boolean;
  pending?: boolean;
  followersCount: number;
  followingChefs?: string[];
}

export interface FollowChangeEvent extends FollowToggleResponse {
  chefId: string;
}

export interface GiftRecipientSuggestion {
  _id: string;
  username: string;
  phoneNumber?: string;
  profilePicture?: string;
  roles?: string[];
  city?: string;
  state?: string;
  region?: string;
  country?: string;
  relationship?: 'mutual' | 'following' | 'follower';
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
 
  private apiUrl = `${environment.apiUrl}/user`;
  private uploadAPI = `${environment.apiUrl}`;
  private userEmail: string | undefined;
  private userName: string | undefined;
  private followChangedSubject = new Subject<FollowChangeEvent | void>();
  followChanged$ = this.followChangedSubject.asObservable();

  constructor(private tokenStorageService: TokenStorageService, private http: HttpClient) {}

  setUserEmail(email: string): void {
    this.userEmail = email;
  }

  getChefProfileByUsername(username: string): Observable<any> {
    return this.http.get<any>(`${this.uploadAPI}/foods/byChef?username=${username}`);
  }

  getChefProfile(username: string): Observable<UserInfo> {
    return this.http.get<UserInfo>(`${this.apiUrl}/profile/${username}`);
  }

  getChefStats(chefId: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/chef-stats/${chefId}`);
  }

  getFollowingChefIds(): Observable<{ followingChefs: string[] }> {
    return this.http.get<{ followingChefs: string[] }>(`${this.apiUrl}/following/ids`);
  }

  getGiftRecipientSuggestions(limit = 8): Observable<{ recipients: GiftRecipientSuggestion[] }> {
    return this.http.get<{ recipients: GiftRecipientSuggestion[] }>(`${this.apiUrl}/gift/suggestions?limit=${limit}`);
  }

  toggleFollowChef(chefId: string): Observable<FollowToggleResponse> {
    return this.http.post<FollowToggleResponse>(
      `${this.apiUrl}/follow/${chefId}`,
      {}
    ).pipe(
      tap((response) => this.notifyFollowChanged({ chefId, ...response }))
    );
  }

  notifyFollowChanged(change?: FollowChangeEvent): void {
    this.followChangedSubject.next(change);
  }

  getChefSummaries(): Observable<Array<{ _id: string; username: string; profilePicture: string; dishCount: number; followersCount: number; score: number }>> {
    return this.http.get<Array<{ _id: string; username: string; profilePicture: string; dishCount: number; followersCount: number; score: number }>>(
      `${this.apiUrl}/chefs/summary`
    );
  }
  
  
  

  getUserDetails(): Observable<UserInfo> {
    const userId = this.tokenStorageService.getUserId();
    if (!userId) {
      return throwError(() => new Error('User ID is not available'));
    }
    return this.http.get<UserInfo>(`${this.apiUrl}/${userId}`);
  }

  getUserById(userId: string): Observable<UserInfo> {
    return this.http.get<UserInfo>(`${this.apiUrl}/${userId}`);
  }
  getChefUsernameById(chefId: string): Observable<UserInfo> {
    return this.http.get<UserInfo>(`${this.uploadAPI}/user/profile/${chefId}`);
    // Assuming your backend endpoint to get chef details by chefId is implemented as /api/user/profile/:chefId
  }
  getUserPreferences(): Observable<UserDetails> {
    return this.http.get<UserDetails>(`${this.apiUrl}/preferences`);
  }

  getSettings(): Observable<UserSettings> {
    return this.http.get<UserSettings>(`${this.apiUrl}/settings`);
  }

  getEditableProfile(): Observable<EditableProfile> {
    return this.http.get<EditableProfile>(`${this.apiUrl}/profile/edit`);
  }

  updateEditableProfile(payload: Partial<EditableProfile>): Observable<{ message: string; profile: EditableProfile }> {
    return this.http.put<{ message: string; profile: EditableProfile }>(`${this.apiUrl}/profile/edit`, payload);
  }

  sendEmailVerification(): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${environment.apiUrl}/auth/send-email-verification`, {});
  }

  verifyEmailCode(code: string): Observable<{ message: string; emailVerified: boolean; emailVerifiedAt?: string | null; rewardPoints?: number }> {
    return this.http.post<{ message: string; emailVerified: boolean; emailVerifiedAt?: string | null; rewardPoints?: number }>(
      `${environment.apiUrl}/auth/verify-email-code`,
      { code }
    );
  }

  updateSettings(payload: Partial<UserSettings>): Observable<{ message: string; settings: UserSettings }> {
    return this.http.put<{ message: string; settings: UserSettings }>(`${this.apiUrl}/settings`, payload);
  }

  changePassword(oldPassword: string, newPassword: string): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.apiUrl}/password`, { oldPassword, newPassword });
  }

  upsertTransactionPin(newPin: string, oldPin?: string): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.apiUrl}/pin`, { newPin, oldPin });
  }

  getMyFollowRequests(): Observable<{ requests: Array<{ requesterId: string; username: string; profilePicture: string; country?: string; requestedAt: string }> }> {
    return this.http.get<{ requests: Array<{ requesterId: string; username: string; profilePicture: string; country?: string; requestedAt: string }> }>(
      `${this.apiUrl}/follow/requests/me`
    );
  }

  approveFollowRequest(requesterId: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/follow/requests/${requesterId}/approve`, {});
  }

  rejectFollowRequest(requesterId: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/follow/requests/${requesterId}/reject`, {});
  }

  updateLocation(lat: number, lng: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/location`, { lat, lng });
  }

  updateUserProfile(formData: FormData): Observable<any> {
    return this.http.put(`${this.uploadAPI}/profile`, formData);
  }

  uploadProfilePicture(formData: FormData): Observable<any> {
    return this.http.post(`${this.uploadAPI}/profile/picture`, formData);
  }

  uploadCoverPicture(formData: FormData): Observable<any> {
    return this.http.post(`${this.uploadAPI}/profile/cover`, formData);
  }

  getUserEmail(): string | undefined {
    const user = this.tokenStorageService.getUser();
    return user?.email;
  }

    getUserName(): string | undefined {
    const user = this.tokenStorageService.getUser();
    return user?.username;
  }

  getUserRole(): string | undefined {
    const roles = this.tokenStorageService.getRoles();
    return Array.isArray(roles) && roles.length > 0 ? roles[0] : undefined;
  }
}
