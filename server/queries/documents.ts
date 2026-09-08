import "server-only";

import { createClient } from "@/lib/supabase/server";

const DOC_SELECT = `
  id, title, description_md, storage_path, mime, size_bytes, audience, target_ids, requires_signature,
  signature_per_student, purpose, version, published_at, created_at, deleted_at, folder_id,
  folder:document_folders ( id, name, sort_order ),
  signatures:document_signatures ( id, user_id, student_id, signed_at )
` as const;

/** Documents visible to the user (RLS), grouped by folder, with their own signatures. */
export async function getDocumentsForUser() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .select(DOC_SELECT)
    .is("deleted_at", null)
    .not("published_at", "is", null)
    .order("published_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getDocument(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .select(DOC_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getAdminDocuments(schoolId: string) {
  const supabase = await createClient();
  const [documents, folders] = await Promise.all([
    supabase
      .from("documents")
      .select(DOC_SELECT)
      .eq("school_id", schoolId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("document_folders")
      .select("id, name, sort_order")
      .eq("school_id", schoolId)
      .order("sort_order"),
  ]);
  if (documents.error) throw documents.error;
  return { documents: documents.data, folders: folders.data ?? [] };
}

export async function getMissingSignatures(documentId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("document_missing_signatures", {
    document: documentId,
  });
  if (error) throw error;
  return data ?? [];
}

export function groupByFolder<
  T extends { folder: { id: string; name: string; sort_order: number } | null },
>(docs: T[]) {
  const groups = new Map<string, { name: string; sort: number; items: T[] }>();
  for (const doc of docs) {
    const key = doc.folder?.id ?? "none";
    const group = groups.get(key) ?? {
      name: doc.folder?.name ?? "",
      sort: doc.folder?.sort_order ?? 999,
      items: [],
    };
    group.items.push(doc);
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => a.sort - b.sort);
}
