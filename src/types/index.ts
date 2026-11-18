/**
 * Type definitions for MediChannel Firebase POC
 * Synthetic data only - no production data
 */

export type NoticeStatus = 'draft' | 'published';

export interface Notice {
  id: string;
  title: string;
  content: string;
  status: NoticeStatus;
  authorId: string;
  authorName: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  publishedAt?: Date | string;
}

export interface CreateNoticeInput {
  title: string;
  content: string;
  status: NoticeStatus;
  authorId: string;
  authorName: string;
}

export interface UpdateNoticeInput {
  title?: string;
  content?: string;
  status?: NoticeStatus;
}

export type ReviewStatus = 'pending' | 'approved' | 'hidden';

export interface Review {
  id: string;
  reviewerName: string;
  reviewerEmail: string;
  rating: number; // 1-5
  comment: string;
  status: ReviewStatus;
  facilityId: string;
  facilityName: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  moderatedAt?: Date | string;
  moderatedBy?: string;
}

export interface CreateReviewInput {
  reviewerName: string;
  reviewerEmail: string;
  rating: number;
  comment: string;
  facilityId: string;
  facilityName: string;
}

export interface ModerateReviewInput {
  status: 'approved' | 'hidden';
  moderatedBy: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timing?: {
    applicationMs: number;
    networkMs: number;
    totalMs: number;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}