import test from 'node:test';
import assert from 'node:assert/strict';
import { verificationFields,isVerifiedAddress,addressFingerprint,validateAddressFields,signLocation,readLocationProof,isSandboxAddress } from '../src/lib/address-policy.ts';
import { isSandboxAddressFallbackEnabled } from '../src/lib/feature-flags.ts';
const address={addressLine1:'Mannerheimintie 9',city:'Helsinki',postalCode:'00100',latitude:60.1699,longitude:24.9384,countryCode:'FI'};
test('verification is bound to stored street, country, postcode and exact coordinates',()=>{
 const verified={...address,...verificationFields(address)};assert.ok(isVerifiedAddress(verified));
 for(const change of [{city:'Lahti'},{addressLine1:'Other 2'},{latitude:60},{countryCode:'SE'},{postalCode:'01000'},{verificationSource:null}]) assert.equal(isVerifiedAddress({...verified,...change}),false);
 assert.ok(isVerifiedAddress({...verified,addressLine2:'E 38'}));
 assert.equal(isVerifiedAddress(address),false);
});
test('Finland validation preserves leading zero and rejects incomplete/foreign fields',()=>{
 assert.doesNotThrow(()=>validateAddressFields(address));assert.equal(address.postalCode,'00100');
 assert.throws(()=>validateAddressFields({...address,postalCode:'1250'}),/five digits/);
 assert.throws(()=>validateAddressFields({...address,countryCode:'SE'}),/only within Finland/);
 assert.throws(()=>validateAddressFields({...address,addressLine1:'Ruopankatu'}),/building number/);
});
test('browser cannot forge or change provider proof',()=>{
 process.env.SESSION_SECRET='a-strong-test-secret-used-only-by-tests-12345';const token=signLocation(address);
 assert.equal(readLocationProof(token).postalCode,'00100');assert.equal(readLocationProof(token+'x'),null);
 const [payload,signature]=token.split('.');const body=JSON.parse(Buffer.from(payload,'base64url'));body.location.countryCode='SE';
 assert.equal(readLocationProof(Buffer.from(JSON.stringify(body)).toString('base64url')+'.'+signature),null);
});
test('sandbox records are explicitly distinct and fallback cannot activate in production',()=>{
 const sandbox={...address,latitude:null,longitude:null};Object.assign(sandbox,verificationFields(sandbox,'SANDBOX'));
 assert.ok(isSandboxAddress(sandbox));assert.equal(isVerifiedAddress(sandbox),false);assert.equal(sandbox.verificationHash,addressFingerprint(sandbox));
 const previous={...process.env};Object.assign(process.env,{NODE_ENV:'production',HOMEFOODS_ENABLE_TEST_DATA:'true',HOMEFOODS_NATIONWIDE_TESTING:'true',ENFORCE_DELIVERY_RADIUS:'false',HOMEFOODS_ALLOW_REMOTE_NATIONWIDE_TESTING:'true',HOMEFOODS_SANDBOX_PAYMENTS:'true',HOMEFOODS_SANDBOX_ADDRESS_FALLBACK:'true',DATABASE_URL:'postgres://localhost/test'});
 assert.equal(isSandboxAddressFallbackEnabled(),false);process.env=previous;
});
