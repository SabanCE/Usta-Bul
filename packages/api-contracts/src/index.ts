export type UserRole = 'customer' | 'artisan' | 'admin';

export interface UserDto {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  role: UserRole;
  isVerified: boolean;
  createdAt: string;
}

export type ServiceCategory =
  | 'plumber'       // Tesisatçı
  | 'electrician'   // Elektrikçi
  | 'painter'       // Boyacı
  | 'carpenter'     // Marangoz
  | 'locksmith'     // Çilingir
  | 'appliance'     // Beyaz Eşya
  | 'cleaning'      // Temizlik
  | 'renovation';   // Ev Tadilatı

export interface CategoryDto {
  id: string;
  slug: string;
  name: string;
  icon: string;
  description?: string;
}

export interface ArtisanServiceDto {
  id: string;
  artisanId: string;
  title: string;
  description?: string;
  price?: number;
  priceUnit?: string;
  createdAt?: string;
}

export interface ArtisanPortfolioDto {
  id: string;
  artisanId: string;
  title: string;
  description?: string;
  imageUrl: string;
  category?: string;
  completedAt?: string;
  createdAt?: string;
}

export interface ArtisanProfileDto {
  id: string;
  userId: string;
  category: ServiceCategory;
  bio: string;
  experienceYears: number;
  rating: number;
  totalReviews: number;
  hourlyRate?: number;
  isApproved: boolean;
  isAvailable?: boolean;
  city: string;
  district: string;
  latitude?: number;
  longitude?: number;
  avatarUrl?: string;
  distanceKm?: number;
  updatedAt?: string;
}

export interface ArtisanListItemDto {
  id: string;
  profileId: string;
  fullName: string;
  email: string;
  phone?: string;
  category: ServiceCategory;
  bio: string;
  experienceYears: number;
  rating: number;
  totalReviews: number;
  hourlyRate?: number;
  isAvailable: boolean;
  city: string;
  district: string;
  latitude?: number;
  longitude?: number;
  avatarUrl?: string;
  distanceKm?: number;
}

export interface ArtisanDetailDto extends ArtisanListItemDto {
  services: ArtisanServiceDto[];
  portfolio: ArtisanPortfolioDto[];
}

// ========================================================
// AŞAMA 4: İŞ & TEKLİF TİPLERİ (Requests & Bids)
// ========================================================
export type RequestUrgency = 'urgent' | 'normal' | 'flexible';

export type JobStatus =
  | 'pending'       // Teklif bekliyor
  | 'bids_received' // Teklifler geldi
  | 'in_progress'   // Teklif kabul edildi, usta çalışıyor
  | 'completed'     // İş tamamlandı
  | 'cancelled';    // İptal edildi

export type BidStatus = 'pending' | 'accepted' | 'rejected';

export interface CreateServiceRequestDto {
  category: ServiceCategory;
  title: string;
  description: string;
  address: string;
  city?: string;
  district?: string;
  latitude?: number;
  longitude?: number;
  urgency?: RequestUrgency;
  preferredDate?: string;
  targetArtisanId?: string; // Belirli bir ustaya doğrudan talep açılırsa
  images?: string[];        // Fotoğraf URL'leri
}

export interface BidDto {
  id: string;
  requestId: string;
  artisanId: string;
  artisanName?: string;
  artisanRating?: number;
  artisanAvatar?: string;
  artisanPhone?: string;
  price: number;
  estimatedDuration?: string;
  note?: string;
  status: BidStatus;
  isAccepted: boolean;
  createdAt: string;
}

export interface ServiceRequestDto {
  id: string;
  customerId: string;
  customerName?: string;
  customerPhone?: string;
  targetArtisanId?: string;
  category: ServiceCategory;
  title: string;
  description: string;
  address: string;
  city?: string;
  district?: string;
  latitude?: number;
  longitude?: number;
  urgency: RequestUrgency;
  status: JobStatus;
  preferredDate?: string;
  images: string[];
  bidsCount?: number;
  bids?: BidDto[];
  acceptedBid?: BidDto;
  createdAt: string;
}

export interface CreateBidDto {
  price: number;
  estimatedDuration?: string;
  note?: string;
}

export interface UpdateJobStatusDto {
  status: JobStatus;
  cancellationReason?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
