import test from "node:test";
import assert from "node:assert/strict";
import { safeReturnPath } from "../src/lib/returnPath";

/**
 * Where a failed action sends you back to.
 *
 * The input is the Referer header, which is whatever the caller wrote. Getting
 * this wrong turns every form in the app into an open redirect, so the hostile
 * cases matter more than the ordinary one.
 */

const HOST = "tkd-manager-tkdtta.vercel.app";

test("comes back to the page the form was on, query and all", () => {
  assert.equal(
    safeReturnPath(`https://${HOST}/clubs?country=Singapore&status=active`, HOST),
    "/clubs?country=Singapore&status=active",
  );
});

test("a referer on someone else's host is not followed", () => {
  assert.equal(safeReturnPath("https://evil.example/clubs", HOST), "/");
});

test("a different port is a different host", () => {
  assert.equal(safeReturnPath("http://localhost:9999/clubs", "localhost:3000"), "/");
});

test("only the path survives — never the origin", () => {
  // Even from our own host, what goes to redirect() is a path, so there is no
  // way for an absolute URL to reach it at all.
  const path = safeReturnPath(`https://${HOST}/events/123`, HOST);
  assert.equal(path, "/events/123");
  assert.ok(!path.includes("://"));
});

test("a protocol-relative path is refused", () => {
  // "//evil.example/x" is a URL browsers follow off-site, not a local path.
  assert.equal(safeReturnPath("https://evil.example//evil.example/x", HOST), "/");
});

test("a non-http scheme is not a page", () => {
  assert.equal(safeReturnPath("javascript:alert(1)", HOST), "/");
  assert.equal(safeReturnPath("data:text/html,<script>", HOST), "/");
});

test("nonsense and absence both fall back", () => {
  assert.equal(safeReturnPath(null, HOST), "/");
  assert.equal(safeReturnPath("", HOST), "/");
  assert.equal(safeReturnPath("not a url", HOST), "/");
});

test("the fragment is dropped", () => {
  assert.equal(safeReturnPath(`https://${HOST}/clubs#add`, HOST), "/clubs");
});
