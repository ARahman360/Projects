import dotenv from 'dotenv';
import pg from 'pg';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

dotenv.config({path:'.env.local',quiet:true});
dotenv.config({quiet:true});
const apply=process.argv.includes('--apply');
const verify=process.argv.includes('--verify');
const client=new pg.Client({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:10000});
const quote=value=>'"'+value.replaceAll('"','""')+'"';
try {
  await client.connect();
  const tables=(await client.query(`SELECT c.relname,c.relrowsecurity FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
    AND c.relkind IN ('r','p') ORDER BY c.relname`)).rows;
  console.log(JSON.stringify({tables:tables.length,rlsDisabled:tables.filter(t=>!t.relrowsecurity).map(t=>t.relname)}));
  if(apply){
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL statement_timeout = '30s'");
    await client.query(await readFile(new URL('../supabase/migrations/202609300001_homefoods_server_only_rls.sql',import.meta.url),'utf8'));
    // Verify inside the transaction before making the security change durable.
  }
  if(apply||verify){
    const disabled=await client.query("SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p') AND NOT c.relrowsecurity");
    assert.equal(disabled.rowCount,0,'public tables must all have RLS');
    let assertions=0;
    for(const role of ['anon','authenticated']){
      for(const table of tables){
        const relation='public.'+quote(table.relname);
        for(const privilege of ['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']){
          const result=await client.query('SELECT has_table_privilege($1,$2,$3) AS allowed',[role,relation,privilege]);
          assert.equal(result.rows[0].allowed,false,role+' '+table.relname+' '+privilege);
          assertions++;
        }
        for(const privilege of ['SELECT','INSERT','UPDATE','REFERENCES']){
          const result=await client.query('SELECT has_any_column_privilege($1,$2,$3) AS allowed',[role,relation,privilege]);
          assert.equal(result.rows[0].allowed,false,role+' column '+table.relname+' '+privilege);
          assertions++;
        }
        // Exercise actual role authorization, without touching application records.
        if(!apply)await client.query('BEGIN');
        await client.query('SAVEPOINT denied_query');
        await client.query('SET LOCAL ROLE '+quote(role));
        let code;
        try{await client.query('SELECT * FROM '+relation+' LIMIT 0');}catch(error){code=error.code;}
        await client.query('ROLLBACK TO SAVEPOINT denied_query');
        assert.equal(code,'42501',role+' direct SELECT must be rejected');
        if(!apply)await client.query('ROLLBACK');
        assertions++;
      }
    }
    for(const table of tables)await client.query('SELECT * FROM public.'+quote(table.relname)+' LIMIT 0');
    if(apply)await client.query('COMMIT');
    console.log(JSON.stringify({securityChecks:'PASS',assertions,backendReadChecks:tables.length,applied:apply}));
  }
  const inventory=await client.query(`SELECT n.nspname,c.relname,c.relkind FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('v','m','f')`);
  const functions=await client.query(`SELECT p.proname,p.prosecdef FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prosecdef AND (has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE'))`);
  console.log(JSON.stringify({otherPublicRelations:inventory.rows,exposedSecurityDefinerFunctions:functions.rows}));
}catch(error){
  await client.query('ROLLBACK').catch(()=>{});
  console.error(JSON.stringify({error:'Database security check failed',code:error.code??error.name,message:error instanceof assert.AssertionError?error.message:undefined}));
  process.exitCode=1;
}finally{await client.end();}
