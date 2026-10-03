import type {ModifierSnapshot} from '@/src/lib/modifiers';
export default function ModifierSummary({values=[]}:{values?:ModifierSnapshot[]}){
  return values.length?<span className="modifier-summary">{values.map(v=><small key={v.groupId+':'+v.optionId}>{v.groupName}: {v.name} {v.price>0?`(+${v.price.toFixed(2)} €)`:'(Free)'}</small>)}</span>:null;
}
