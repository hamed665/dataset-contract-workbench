import {requireValue,record,boundedArray,finite,canonical} from './validation.mjs';

const validTypes=new Set(['string','number','integer','boolean']);
function typeMatches(value,type) {
  if(type==='integer') return Number.isSafeInteger(value);
  if(type==='number') return finite(value);
  return typeof value===type;
}
export function validateDataset(rows,contract) {
  boundedArray(rows,'rows');
  requireValue(record(contract)&&record(contract.fields),'contract.fields required');
  const fields=Object.entries(contract.fields);
  requireValue(fields.length>0 && fields.length<=100,'1–100 fields required');
  for(const [field,spec] of fields) {
    requireValue(field.length>0&&record(spec)&&validTypes.has(spec.type),'invalid field definition');
    for(const flag of ['required','nullable','unique']) requireValue(spec[flag]===undefined||typeof spec[flag]==='boolean',`invalid ${flag} flag`);
    if(spec.min!==undefined||spec.max!==undefined) {
      requireValue(['number','integer'].includes(spec.type),'bounds require numeric field');
      requireValue((spec.min===undefined||finite(spec.min))&&(spec.max===undefined||finite(spec.max)),'finite bounds required');
      requireValue(spec.min===undefined||spec.max===undefined||spec.min<=spec.max,'inverted bounds');
    }
    if(spec.enum!==undefined) requireValue(Array.isArray(spec.enum)&&spec.enum.length>0&&spec.enum.every(v=>typeMatches(v,spec.type)),'invalid enum');
  }
  requireValue(contract.allow_extra===undefined||typeof contract.allow_extra==='boolean','invalid allow_extra');
  const issues=[], quarantined=new Set(),seen=new Map();
  function issue(index,field,code) {issues.push({row:index,field,code});quarantined.add(index);}
  rows.forEach((row,index)=>{
    if(!record(row)) {issue(index,'$','ROW_NOT_OBJECT');return;}
    if(!contract.allow_extra) for(const field of Object.keys(row)) if(!Object.hasOwn(contract.fields,field)) issue(index,field,'UNEXPECTED_FIELD');
    for(const [field,spec] of fields) {
      if(!Object.hasOwn(row,field)) {if(spec.required) issue(index,field,'REQUIRED');continue;}
      const value=row[field];
      if(value===null) {if(!spec.nullable) issue(index,field,'NULL_NOT_ALLOWED');continue;}
      if(!typeMatches(value,spec.type)) {issue(index,field,'TYPE');continue;}
      if(spec.min!==undefined && value<spec.min) issue(index,field,'BELOW_MIN');
      if(spec.max!==undefined && value>spec.max) issue(index,field,'ABOVE_MAX');
      if(spec.enum && !spec.enum.some(v=>Object.is(v,value))) issue(index,field,'ENUM');
      if(spec.unique) {
        const key=canonical([field,value]);
        if(seen.has(key)) {
          const first=seen.get(key);
          if(!issues.some(i=>i.row===first&&i.field===field&&i.code==='DUPLICATE')) issue(first,field,'DUPLICATE');
          issue(index,field,'DUPLICATE');
        } else seen.set(key,index);
      }
    }
  });
  return {issues,quarantine_indices:[...quarantined].sort((a,b)=>a-b),valid_count:rows.length-quarantined.size};
}
export function analyze(input) {
  requireValue(record(input),'object input required');
  const report=validateDataset(input.rows,input.contract);
  return {summary:[{label:'Rows inspected',value:input.rows.length},{label:'Accepted',value:report.valid_count},{label:'Quarantined',value:report.quarantine_indices.length}],
    note:'Issue reports contain row numbers, field names and codes. Raw cell values are never included. Row numbers start at zero.',
    columns:['row','field','code'],rows:report.issues,...report};
}
