// food.interface.ts (or food.model.ts)
export interface User {
  _id: string;
  name: string;
  // Add other fields if necessary
}

export interface Food {
  chef: any;
  name:String,
  _id: string;
  chefID:string;
  dishName: string;
  preparationTime: string;
  price: number;
  priceCurrency?: string;
  category: string;
  availability: string;
  ingredients?: string;
  ingredientsList?: string[];
  verificationStatus?: 'verified' | 'unverified';
  profileCompletion?: {
    requiredFields?: string[];
    missingFields?: string[];
    percent?: number;
    verified?: boolean;
    verifiedAt?: string;
  };
  recommendationTag?: 'suggested' | 'not_recommended' | '';
  additionalDetails?: Record<string, any>;
  image: string;
  imageProvider?: string;
  imagePublicId?: string;
  createdBy: string; // Assuming createdBy is stored as the chef's ID
  createdAt: Date;
  updatedAt: Date;
  chefName?: string; // Optional field to hold chef's name
  comments?: Array<{
    userId: string;
    username: string;
    text: string;
    createdAt: string;
  }>;
  likes?: number;
  likedBy?: string[];
  
}
