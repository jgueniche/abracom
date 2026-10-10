import { describe, expect, it } from "vitest";

import {
  CLASS_MEDIA_PATH,
  classMediaFolder,
  classUploadSchema,
  formatBytes,
  isFileInFolder,
  isPendingOriginal,
  MESSAGE_PATH,
  messageFolder,
  messageUploadSchema,
  parseUploadList,
  stemOf,
  storageName,
} from "@/lib/uploads/shared";

const school = "00000000-0000-4000-8000-000000000001";
const klass = "00000000-0000-4000-8000-000000000514";
const post = "e0000000-0000-4000-8000-000000000033";
const thread = "00000000-0000-4000-8000-000000003090";

describe("storage names", () => {
  it("are URL-safe, unique and still say what the file was", () => {
    const name = storageName("Fiche de révision — Page 12.JPG", "upload.jpg", "ab12c");
    expect(name).toMatch(/^[a-z0-9]+-ab12c-fiche-de-revision-page-12\.upload\.jpg$/);
    expect(storageName("IMG_0001.jpg")).not.toBe(storageName("IMG_0001.jpg"));
  });

  it("never start with something a path could mistake for a folder", () => {
    expect(storageName("../../etc/passwd", "pdf", "x")).toMatch(/^[a-z0-9]+-x-passwd\.pdf$/);
    expect(storageName("", "pdf", "x")).toMatch(/-x-fichier\.pdf$/);
  });

  it("tell an original waiting for the server from a normalised file", () => {
    const original = `${classMediaFolder(school, klass, post)}/k3x-ab12c-page.upload.jpg`;
    expect(isPendingOriginal(original)).toBe(true);
    expect(isPendingOriginal(original.replace(".upload.jpg", ".webp"))).toBe(false);
    expect(stemOf(original)).toBe(`${classMediaFolder(school, klass, post)}/k3x-ab12c-page`);
    expect(stemOf(`${classMediaFolder(school, klass, post)}/k3x-page.pdf`)).toBe(
      `${classMediaFolder(school, klass, post)}/k3x-page`,
    );
  });
});

describe("a file in a folder", () => {
  const folder = classMediaFolder(school, klass, post);

  it("is a name directly inside the folder", () => {
    expect(isFileInFolder(`${folder}/k3x-page.upload.jpg`, folder)).toBe(true);
    expect(
      isFileInFolder(
        `${messageFolder(school, thread)}/k3x-photo.jpg`,
        messageFolder(school, thread),
      ),
    ).toBe(true);
  });

  it("is nothing cleverer", () => {
    expect(isFileInFolder(`${folder}/../other/page.jpg`, folder)).toBe(false);
    expect(isFileInFolder(`${folder}/sub/page.jpg`, folder)).toBe(false);
    expect(isFileInFolder(`${folder}page.jpg`, folder)).toBe(false);
    expect(isFileInFolder(`${folder}/.hidden`, folder)).toBe(false);
    expect(isFileInFolder(`${school}/${klass}/page.jpg`, `${school}/${klass}`)).toBe(true);
    // a folder that is not made of identifiers is refused outright
    expect(isFileInFolder("a/b/page.jpg", "a/b")).toBe(false);
  });

  it("is recognised by the redirect routes", () => {
    expect(CLASS_MEDIA_PATH.test(`${folder}/k3x-page.webp`)).toBe(true);
    expect(CLASS_MEDIA_PATH.test(`${school}/${klass}/k3x-page.webp`)).toBe(false);
    expect(MESSAGE_PATH.test(`${school}/${thread}/k3x-photo.jpg`)).toBe(true);
    // names written by the previous upload code stay readable
    expect(MESSAGE_PATH.test(`${school}/${thread}/mfx2b9k-Devoir-de-Noam.pdf`)).toBe(true);
    expect(MESSAGE_PATH.test(`${school}/${thread}/../x.jpg`)).toBe(false);
  });
});

describe("what a form says it uploaded", () => {
  it("is parsed strictly, and anything malformed is an empty list", () => {
    const valid = JSON.stringify([
      { path: "a/b.upload.jpg", kind: "image", name: "page.jpg", rotation: 90 },
      { path: "a/b.pdf", kind: "pdf", name: "fiche.pdf" },
    ]);
    expect(parseUploadList(valid, classUploadSchema)).toEqual([
      { path: "a/b.upload.jpg", kind: "image", name: "page.jpg", rotation: 90 },
      { path: "a/b.pdf", kind: "pdf", name: "fiche.pdf", rotation: 0 },
    ]);
    expect(parseUploadList('[{"path":1}]', classUploadSchema)).toEqual([]);
    expect(parseUploadList("not json", classUploadSchema)).toEqual([]);
    expect(parseUploadList(null, classUploadSchema)).toEqual([]);
    expect(
      parseUploadList(
        JSON.stringify([{ path: "a/b.upload.jpg", kind: "image", name: "p", rotation: 45 }]),
        classUploadSchema,
      ),
    ).toEqual([]);
  });

  it("only names the types the messages bucket accepts", () => {
    const base = { path: "a/b.jpg", name: "b.jpg", size: 10 };
    expect(messageUploadSchema.safeParse({ ...base, mime: "image/jpeg" }).success).toBe(true);
    expect(messageUploadSchema.safeParse({ ...base, mime: "image/heic" }).success).toBe(false);
    expect(
      messageUploadSchema.safeParse({ ...base, mime: "image/jpeg", color: "red" }).success,
    ).toBe(false);
  });
});

describe("file sizes", () => {
  it("read the way a family reads them", () => {
    expect(formatBytes(512)).toBe("512 o");
    expect(formatBytes(245_760)).toBe("240 Ko");
    expect(formatBytes(3_355_443)).toBe("3,2 Mo");
    expect(formatBytes(3_355_443, "en")).toBe("3.2 MB");
  });
});
