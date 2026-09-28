import test from 'node:test';
import assert from 'node:assert/strict';
import {profileInputError} from '../src/lib/profile-policy.ts';
test('profile edits allow only self-service fields',()=>{
 assert.equal(profileInputError({action:'profile',name:'Home Cook',phone:'+358 401234567'}),null);
 assert.ok(profileInputError({action:'profile',name:'A',phone:''}));
 assert.ok(profileInputError({action:'profile',name:'Cook',phone:'not a number'}));
 assert.ok(profileInputError({action:'profile',name:'Cook',phone:'',role:'ADMIN'}));
 assert.ok(profileInputError({action:'profile',name:'Cook',phone:'',userId:2}));
});
test('sensitive input validation rejects email changes and short passwords',()=>{
 assert.ok(profileInputError({action:'email',email:'broken'}));
 assert.ok(profileInputError({action:'email',email:'cook@example.test'}));
 assert.ok(profileInputError({action:'password',newPassword:'short'}));
});
