import type { DesignCategory, Role } from '@moodly/shared';

export type ApiUser = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

export type Design = {
  id: string;
  title: string;
  description: string | null;
  category: DesignCategory;
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  likesCount: number;
  commentsCount: number;
  bookmarksCount: number;
  createdAt: string;
  tailor: ApiUser;
  likedByMe: boolean;
  bookmarkedByMe: boolean;
};

export type Feed = {
  designs: Design[];
  page: number;
  hasMore: boolean;
};

export type Comment = {
  id: string;
  text: string;
  createdAt: string;
  user: ApiUser;
};

export type DesignDetail = {
  design: Design;
  comments: Comment[];
};

export type AuthUser = {
  id: string;
  phone: string;
  name: string;
  role: Role;
  avatarUrl: string | null;
};

export type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};
