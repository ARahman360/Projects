import test from "node:test";
import assert from "node:assert/strict";
import { isSameOriginRequest } from "../src/lib/request-security.ts";

test("same-origin validation accepts the browser origin through a local reverse proxy", () => {
  const request = new Request("http://next-internal:3000/api/auth", { method: "POST", headers: { origin: "http://localhost:3000", host: "next-internal:3000", "x-forwarded-host": "localhost:3000", "x-forwarded-proto": "http" } });
  assert.equal(isSameOriginRequest(request), true);
});

test("same-origin validation still rejects a foreign browser origin", () => {
  const request = new Request("http://next-internal:3000/api/auth", { method: "POST", headers: { origin: "https://attacker.invalid", host: "next-internal:3000", "x-forwarded-host": "localhost:3000", "x-forwarded-proto": "http" } });
  assert.equal(isSameOriginRequest(request), false);
});
