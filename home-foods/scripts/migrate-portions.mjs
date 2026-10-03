import dotenv from 'dotenv';
import pg from 'pg';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
dotenv.config({path:'.env.local',quiet:true});dotenv.config({quiet:true});
const client=new pg.Client({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:10000});
try{
 await client.connect();await client.query('BEGIN');
 await client.query("SET LOCAL lock_timeout='5s'");
 const security=()=>client.query(`SELECT c.relrowsecurity,c.relacl::text,(SELECT json_agg(p ORDER BY p.policyname) FROM pg_policies p WHERE p.schemaname='public' AND p.tablename='menuItemOption') AS policies FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='menuItemOption'`);
 const before=(await security()).rows;
 assert.equal(before[0]?.relrowsecurity,true,'Existing option security must be enabled');
 if(process.argv.includes('--apply'))await client.query(await readFile(new URL('../supabase/migrations/202610020001_menu_portion_default.sql',import.meta.url),'utf8'));
 const column=(await client.query(`SELECT data_type,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='menuItemOption' AND column_name='isDefault'`)).rows[0];
 assert.equal(column?.data_type,'boolean');assert.equal(column?.is_nullable,'NO');assert.equal(column?.column_default,'false');
 assert.deepEqual((await security()).rows,before,'Policies and grants must remain identical');
 await client.query('COMMIT');console.log('Portion default column verified; RLS, policies and grants unchanged.');
}catch(error){await client.query('ROLLBACK').catch(()=>{});console.error(error instanceof Error?error.message:'Portion migration failed');process.exitCode=1;}finally{await client.end();}
