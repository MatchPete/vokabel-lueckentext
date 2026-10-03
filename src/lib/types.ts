// Von Hand gepflegte Typen für die Tabellen, die die App nutzt.
// Später durch `supabase gen types` ersetzbar.

export type Child = {
  id: string;
  nickname: string;
  textbook_id: string | null;
  current_unit_id: string | null;
  created_at: string;
};

export type Unit = {
  id: string;
  child_id: string;
  textbook_unit_id: string | null;
  title: string;
  sort_order: number;
};

export type Textbook = {
  id: string;
  name: string;
  edition: string | null;
};
