import test from "node:test";
import assert from "node:assert/strict";
import { getSessionSigningSecret } from "../src/lib/session-secret.ts";

test("development session secret is stable across independently loaded server routes", () => {
  const prior = { node: process.env.NODE_ENV, session: process.env.SESSION_SECRET, database: process.env.DATABASE_URL };
  try {
    process.env.NODE_ENV = "development";
    delete process.env.SESSION_SECRET;
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/homefoods";
    const first = getSessionSigningSecret();
    assert.equal(first, getSessionSigningSecret());
    assert.equal(first.length >= 32, true);
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/other";
    assert.notEqual(first, getSessionSigningSecret());
  } finally {
    for (const [key, value] of [["NODE_ENV", prior.node], ["SESSION_SECRET", prior.session], ["DATABASE_URL", prior.database]]) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});

test("production still requires a configured strong session secret", () => {
  const prior = { node: process.env.NODE_ENV, session: process.env.SESSION_SECRET, database: process.env.DATABASE_URL };
  try {
    process.env.NODE_ENV = "production";
    delete process.env.SESSION_SECRET;
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/homefoods";
    assert.throws(() => getSessionSigningSecret(), /SESSION_SECRET/);
    process.env.SESSION_SECRET = "a".repeat(32);
    assert.equal(getSessionSigningSecret(), "a".repeat(32));
  } finally {
    for (const [key, value] of [["NODE_ENV", prior.node], ["SESSION_SECRET", prior.session], ["DATABASE_URL", prior.database]]) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});
