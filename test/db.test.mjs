import test from "node:test";
import assert from "node:assert/strict";
import { sslConfig } from "../api/_lib/db.js";

test("verifies certificates by default", () => {
  assert.deepEqual(sslConfig({}), { rejectUnauthorized: true });
});

test("PGSSLMODE=disable turns TLS off for local Postgres", () => {
  assert.equal(sslConfig({ PGSSLMODE: "disable" }), false);
});

test("DATABASE_CA_CERT pins the provider CA with verification on", () => {
  const config = sslConfig({ DATABASE_CA_CERT: "-----BEGIN CERTIFICATE-----\\nabc\\n-----END CERTIFICATE-----" });
  assert.equal(config.rejectUnauthorized, true);
  assert.equal(config.ca, "-----BEGIN CERTIFICATE-----\nabc\n-----END CERTIFICATE-----");
});

test("DATABASE_SSL_NO_VERIFY=1 keeps TLS but skips verification", () => {
  assert.deepEqual(sslConfig({ DATABASE_SSL_NO_VERIFY: "1" }), { rejectUnauthorized: false });
});

test("CA cert takes precedence over the no-verify escape hatch", () => {
  const config = sslConfig({ DATABASE_CA_CERT: "cert", DATABASE_SSL_NO_VERIFY: "1" });
  assert.equal(config.rejectUnauthorized, true);
});
