export interface Book {
  id: string;
  title: string;
  author: string;
  genre: string;
  isbn: string;
  description?: string;
  coverImage?: string;
  totalCopies: number;
  availableCopies: number;
}

export interface BookListResponse {
  items: Book[];
  total: number;
  page: number;
  pages: number;
}
