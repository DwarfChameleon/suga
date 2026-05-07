// UserInfo interface
export interface UserInfo {
  _id: string;
  roles: string[];
  id: number;
  username: string;
  fullName: string;
  email: string;
  phone: string;
  address: string;
  homeAddress: string;
  password: string;
  restaurantOwn: boolean;
  category: string;
  restaurantLocation: string;
  restaurantName: string;
  status: string;
  currentDate: Date;
  kitchenPhone: string;
  currentDateAndTime: Date;
  phoneNumber?: string;
  city?: string;
  state?: string;
  region?: string;
  suburb?: string;
  localGovernment?: string;
  street?: string;
  country?: string;
  preferredCurrency?: string;
  isOnline?: boolean;
  uiTheme?: 'light' | 'dark';
  isPrivateChef?: boolean;
  profilePicture?: string;
  coverPicture?: string;
  emailVerified?: boolean;

}

// UserDetails interface
export interface UserDetails {
  _id: any;
  username: string;
  email: string;
  roles: string[];
  phone: string;
  homeAddress: string;
  phoneNumber?: string;
  city?: string;
  state?: string;
  region?: string;
  suburb?: string;
  localGovernment?: string;
  street?: string;
  country?: string;
  preferredCurrency?: string;
  isOnline?: boolean;
  uiTheme?: 'light' | 'dark';
  isPrivateChef?: boolean;
  profilePicture?: string;
  coverPicture?: string;
  emailVerified?: boolean;
} 
