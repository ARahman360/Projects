import test from "node:test";
import assert from "node:assert/strict";
import { isKitchenLocationAllowed, isDeliveryRadiusEnforced, isDevelopmentSandboxEnabled, isNationwideDevelopmentMode, isNationwideDevelopmentSeller } from "../src/lib/feature-flags.ts";

const names = ["NODE_ENV", "HOMEFOODS_ENABLE_TEST_DATA", "HOMEFOODS_NATIONWIDE_TESTING", "ENFORCE_DELIVERY_RADIUS", "HOMEFOODS_ALLOW_REMOTE_NATIONWIDE_TESTING", "HOMEFOODS_SANDBOX_PAYMENTS", "DATABASE_URL", "HOMEFOODS_INCLUDE_EXISTING_SELLERS_IN_DEVELOPMENT"];
function withEnv(values, run) {
  const prior = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  for (const name of names) { if (values[name] === undefined) delete process.env[name]; else process.env[name] = values[name]; }
  try { run(); }
  finally { for (const name of names) { if (prior[name] === undefined) delete process.env[name]; else process.env[name] = prior[name]; } }
}

test("nationwide delivery is an explicit local development-only opt-in", () => {
  const localFlags = { NODE_ENV: "development", HOMEFOODS_ENABLE_TEST_DATA: "true", HOMEFOODS_NATIONWIDE_TESTING: "true", ENFORCE_DELIVERY_RADIUS: "false", DATABASE_URL: "postgresql://u:p@localhost:5432/test" };
  withEnv(localFlags, () => { assert.equal(isNationwideDevelopmentMode(), true); assert.equal(isDeliveryRadiusEnforced(), false); });
  withEnv({ ...localFlags, NODE_ENV: "production" }, () => { assert.equal(isNationwideDevelopmentMode(), false); assert.equal(isDeliveryRadiusEnforced(), true); });
  withEnv({ ...localFlags, DATABASE_URL: "postgresql://u:p@db.example:5432/test" }, () => { assert.equal(isNationwideDevelopmentMode(), false); assert.equal(isDeliveryRadiusEnforced(), true); });
  withEnv({ ...localFlags, DATABASE_URL: "postgresql://u:p@db.example:5432/test", HOMEFOODS_ALLOW_REMOTE_NATIONWIDE_TESTING: "true" }, () => { assert.equal(isNationwideDevelopmentMode(), true); });
  withEnv({ ...localFlags, ENFORCE_DELIVERY_RADIUS: "true" }, () => { assert.equal(isNationwideDevelopmentMode(), false); assert.equal(isDeliveryRadiusEnforced(), true); });
});

test("sandbox payments require development and fictional test data", () => {
  withEnv({ NODE_ENV: "development", HOMEFOODS_ENABLE_TEST_DATA: "true", HOMEFOODS_SANDBOX_PAYMENTS: "true" }, () => assert.equal(isDevelopmentSandboxEnabled(), true));
  withEnv({ NODE_ENV: "production", HOMEFOODS_ENABLE_TEST_DATA: "true", HOMEFOODS_SANDBOX_PAYMENTS: "true" }, () => assert.equal(isDevelopmentSandboxEnabled(), false));
});

test("discovery and checkout share the existing-seller development opt-in",()=>{
 const seller={name:"Ordinary kitchen owner",email:"owner@example.test"};
 const flags={NODE_ENV:"development",HOMEFOODS_ENABLE_TEST_DATA:"true",HOMEFOODS_NATIONWIDE_TESTING:"true",ENFORCE_DELIVERY_RADIUS:"false",HOMEFOODS_INCLUDE_EXISTING_SELLERS_IN_DEVELOPMENT:"true",DATABASE_URL:"postgresql://localhost/test"};
 withEnv(flags,()=>assert.equal(isNationwideDevelopmentSeller(seller),true));
 withEnv({...flags,HOMEFOODS_INCLUDE_EXISTING_SELLERS_IN_DEVELOPMENT:"false"},()=>assert.equal(isNationwideDevelopmentSeller(seller),false));
 withEnv({...flags,NODE_ENV:"production"},()=>{assert.equal(isNationwideDevelopmentSeller(seller),false);assert.equal(isDeliveryRadiusEnforced(),true);});
});

test("development placeholder kitchens cannot be used in production",()=>{withEnv({NODE_ENV:"production"},()=>{assert.equal(isKitchenLocationAllowed("[SANDBOX LOCATION] Example"),false);assert.equal(isKitchenLocationAllowed("Verified street 1"),true);});});
