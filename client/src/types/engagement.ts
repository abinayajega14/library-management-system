import type { Book } from "./book";

export interface WaitlistState {
  position: number | null;
  waiting: number;
  canBorrow: boolean;
}

export interface BookReview {
  id: string;
  name: string;
  rating: number;
  comment: string;
  updatedAt: string;
}

export interface ReviewSummary {
  averageRating: number | null;
  reviewCount: number;
  ownReview: {
    id: string;
    rating: number;
    comment: string;
  } | null;
  reviews: BookReview[];
}

export interface RecentlyViewedBook {
  book: Book;
  viewedAt: string;
}

export interface BookRecommendation {
  book: Book;
  reason: string;
}
