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

/**
 * Every row of a query. The API answers at most `max_rows` rows (1 000 in config.toml): read in one
 * call, a table past that size listed only part of its files, and `--delete` then removed photos
 * that were still published. The offset moves by what actually came back, whatever the cap.
 */
async function everyRow(query) {
  const rows = [];
  for (;;) {
    const { data, error } = await query().range(rows.length, rows.length + 999);
    if (error) throw error;
    if (data.length === 0) return rows;
    rows.push(...data);
  }
}

// Where each bucket's files are named. A published page or photo is two objects, the image and
// its thumbnail (session 33): a thumbnail missing from this list would be swept as an orphan a day
// after it was written. Only these buckets are listed — one this script does not know is never swept.
const tables = [
  ["class_post_media", "storage_path", "class-media"],
  ["class_post_media", "thumb_path", "class-media"],
  ["documents", "storage_path", "documents"],
  ["announcement_attachments", "storage_path", "attachments"],
  ["absences", "justification_path", "justifications"],
  ["profiles", "avatar_path", "avatars"],
];
const buckets = [...new Set([...tables.map(([, , bucket]) => bucket), "messages"])];

async function referenced() {
  const paths = new Set();
  const add = (bucket, path) => path && paths.add(`${bucket}/${path}`);
  for (const [table, column, bucket] of tables) {
    const rows = await everyRow(() =>
      supabase.from(table).select(column).not(column, "is", null).order(column),
    );
    for (const row of rows) add(bucket, row[column]);
  }
  const messages = await everyRow(() =>
    supabase.from("messages").select("id, attachments").neq("attachments", "[]").order("id"),
  );
  for (const row of messages)
    for (const item of row.attachments ?? []) {
      add("messages", item?.path);
      add("messages", item?.thumb);
    }
  return paths;
}

/**
 * Every object of a bucket, through the Storage API. The script used to read `storage.objects`
 * through the REST API, which does not expose the `storage` schema (config.toml, and Supabase's
 * default): it stopped there and had never swept anything. A folder comes back with no id.
 */
async function objectsIn(bucket, prefix = "") {
  const found = [];
  for (let offset = 0; ;) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(prefix, { limit: 1000, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw error;
    if (data.length === 0) return found;
    offset += data.length;
    for (const entry of data) {
      const name = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null) found.push(...(await objectsIn(bucket, name)));
      else found.push({ bucket_id: bucket, name, created_at: entry.created_at });
    }
  }
}

async function objects() {
  const found = [];
  for (const bucket of buckets) found.push(...(await objectsIn(bucket)));
  return found;
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
