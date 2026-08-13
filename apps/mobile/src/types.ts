import type {
  DesignCategory,
  MeasurementKey,
  MeasurementSource,
  OrderStatus,
  PaymentStatus,
  Role,
} from '@moodly/shared';

export type ApiUser = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

export type MediaType = 'IMAGE' | 'VIDEO';

export type Media = {
  id: string;
  type: MediaType;
  url: string;
  thumbnailUrl: string | null;
  width: number;
  height: number;
  duration: number | null;
  blurhash: string | null;
  position: number;
};

export type Design = {
  id: string;
  title: string;
  description: string | null;
  category: DesignCategory;
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  coverBlurhash: string | null;
  mediaCount: number;
  media: Media[];
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

export type CollectionSummary = { id: string; name: string; count: number; covers: string[] };

export type FeedPage = { designs: Design[]; nextCursor: string | null };

export type Comment = {
  id: string;
  text: string;
  createdAt: string;
  user: ApiUser;
};

export type ApiComment = {
  id: string;
  text: string;
  createdAt: string;
  parentId: string | null;
  pinned: boolean;
  likesCount: number;
  likedByMe: boolean;
  user: ApiUser;
  replies: ApiComment[];
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

export type OrderDesign = { id: string; title: string; imageUrl: string; coverBlurhash: string | null } | null;

export type Order = {
  id: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  agreedPrice: number | null;
  note: string | null;
  estimatedDelivery: string | null;
  createdAt: string;
  client: ApiUser;
  tailor: ApiUser;
  design: OrderDesign;
};

export type OrderEvent = {
  id: string;
  status: OrderStatus;
  note: string | null;
  createdAt: string;
};

export type OrderDetail = Order & {
  measurementsSnapshot: Record<string, number> | null;
  events: OrderEvent[];
};

export type ClientRecord = {
  id: string;
  name: string;
  phone: string | null;
  stylePref: string | null;
  tissuPref: string | null;
  coupePref: string | null;
  notes: string | null;
  userId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Measurement = {
  id: string;
  source: MeasurementSource;
  createdAt: string;
} & Partial<Record<MeasurementKey, number | null>>;

export type SelfMeasurement = {
  id: string;
  source: MeasurementSource;
  updatedAt: string;
} & Partial<Record<MeasurementKey, number | null>>;

export type NotificationType = 'LIKE' | 'COMMENT' | 'REPLY' | 'FOLLOW' | 'ORDER';

export type ApiNotification = {
  id: string;
  type: NotificationType;
  actorCount: number;
  read: boolean;
  createdAt: string;
  updatedAt: string;
  lastActor: { id: string; name: string; avatarUrl: string | null } | null;
  design: { id: string; title: string; imageUrl: string; coverBlurhash: string | null } | null;
  commentId: string | null;
  orderId: string | null;
};
