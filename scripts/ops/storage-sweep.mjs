#!/usr/bin/env node
/**
 * Removes storage objects no table references any more (docs/RGPD.md §3).
 *   pnpm ops:storage-sweep            # dry run: lists orphans
 *   pnpm ops:storage-sweep --delete   # deletes them (objects younger than 24 h are always kept)
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}
const remove = process.argv.includes("--delete");
const supabase = createClient(url, key, { auth: { persistSession: false } });

async function referenced() {
  const paths = new Set();
  const add = (bucket, path) => path && paths.add(`${bucket}/${path}`);
  const tables = [
    ["class_post_media", "storage_path", "class-media"],
    ["documents", "storage_path", "documents"],
    ["announcement_attachments", "storage_path", "attachments"],
    ["absences", "justification_path", "justifications"],
    ["profiles", "avatar_path", "avatars"],
  ];
  for (const [table, column, bucket] of tables) {
    const { data, error } = await supabase.from(table).select(column).not(column, "is", null);
    if (error) throw error;
    for (const row of data) add(bucket, row[column]);
  }
  const { data: messages, error } = await supabase
    .from("messages")
    .select("attachments")
    .neq("attachments", "[]");
  if (error) throw error;
  for (const row of messages) for (const item of row.attachments ?? []) add("messages", item?.path);
  return paths;
}

async function objects() {
  const rows = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .schema("storage")
      .from("objects")
      .select("bucket_id, name, created_at")
      .range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < pageSize) break;
  }
  return rows;
}

const keep = await referenced();
const all = await objects();
const dayAgo = Date.now() - 24 * 3_600_000;
const orphans = all.filter(
  (o) => !keep.has(`${o.bucket_id}/${o.name}`) && new Date(o.created_at).getTime() < dayAgo,
);
console.log(
  `${all.length} objects, ${keep.size} referenced paths, ${orphans.length} orphans${remove ? "" : " (dry run)"}`,
);
for (const o of orphans) console.log(`  ${o.bucket_id}/${o.name}`);
if (remove && orphans.length > 0) {
  const byBucket = new Map();
  for (const o of orphans)
    byBucket.set(o.bucket_id, [...(byBucket.get(o.bucket_id) ?? []), o.name]);
  for (const [bucket, names] of byBucket) {
    for (let i = 0; i < names.length; i += 100) {
      const { error } = await supabase.storage.from(bucket).remove(names.slice(i, i + 100));
      if (error) throw error;
    }
    console.log(`deleted ${names.length} objects from ${bucket}`);
  }
}
