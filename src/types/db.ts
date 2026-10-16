export type ConversationState = "idle" | "awaiting_location" | "registered";

export type LineUser = {
  id: string;
  line_user_id: string;
  display_name: string | null;
  state: ConversationState;
  current_place_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Place = {
  id: string;
  line_user_id: string;
  latitude: number;
  longitude: number;
  address: string | null;
  title: string | null;
  created_at: string;
};

export type PlacePhoto = {
  id: string;
  place_id: string;
  storage_path: string;
  content_type: string;
  created_at: string;
};

export type PlaceComment = {
  id: string;
  place_id: string;
  body: string;
  created_at: string;
};
