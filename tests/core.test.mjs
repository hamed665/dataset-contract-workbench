import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sample=JSON.parse(readFileSync(new URL('../examples/input.json',import.meta.url)));

import {validateDataset,analyze} from '../src/core.mjs';
test('both sides of duplicate are quarantined',()=>assert.deepEqual(analyze(sample).quarantine_indices,[0,1,2]));
test('raw values absent from report',()=>{
  const r=validateDataset([{secret:'private-value'}],{fields:{secret:{type:'integer'}}});
  assert.equal(JSON.stringify(r).includes('private-value'),false); assert.equal(r.issues[0].code,'TYPE');
});
test('missing differs from nullable',()=>{
  const c={fields:{x:{type:'string',required:true,nullable:true}}};
  assert.equal(validateDataset([{x:null}],c).valid_count,1); assert.equal(validateDataset([{}],c).issues[0].code,'REQUIRED');
});
test('strict numeric types',()=>assert.equal(validateDataset([{x:'2'},{x:2.5},{x:true}],{fields:{x:{type:'integer'}}}).valid_count,0));
test('extra fields rejected by default',()=>assert.equal(validateDataset([{x:1,y:2}],{fields:{x:{type:'integer'}}}).issues[0].code,'UNEXPECTED_FIELD'));
test('extra fields allowed explicitly',()=>assert.equal(validateDataset([{x:1,y:2}],{allow_extra:true,fields:{x:{type:'integer'}}}).valid_count,1));
test('invalid contract fails before row processing',()=>assert.throws(()=>validateDataset([],{fields:{x:{type:'integer',min:10,max:1}}}),/inverted/));
test('non object row quarantined',()=>assert.equal(validateDataset([null],sample.contract).issues[0].code,'ROW_NOT_OBJECT'));
