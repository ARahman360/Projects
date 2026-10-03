export type PortionOption = {id:number;name:string;price:number;isAvailable:boolean;isDefault:boolean};
export type PortionDraft = Omit<PortionOption,'id'> & {id?:number};

export class PortionError extends Error {}

export function validatePortions(value:unknown):PortionDraft[]{
  if(!Array.isArray(value)||value.length>20)throw new PortionError('Use up to 20 portion options.');
  const names=new Set<string>(),ids=new Set<number>();
  let defaults=0;
  return value.map(raw=>{
    if(!raw||typeof raw!=='object')throw new PortionError('Invalid portion option.');
    const row=raw as Record<string,unknown>;
    const name=typeof row.name==='string'?row.name.trim():'';
    if(!name||name.length>60||names.has(name.toLowerCase()))throw new PortionError('Give each portion a unique label of up to 60 characters.');
    names.add(name.toLowerCase());
    if(typeof row.price!=='number'||!Number.isFinite(row.price)||row.price<0.5||row.price>500)throw new PortionError('Each portion needs a price between €0.50 and €500.');
    if(typeof row.isAvailable!=='boolean'||typeof row.isDefault!=='boolean')throw new PortionError('Choose availability and default for each portion.');
    if(row.isDefault&&++defaults>1)throw new PortionError('Choose only one default portion.');
    if(row.id!==undefined){if(typeof row.id!=='number'||!Number.isInteger(row.id)||row.id<1||ids.has(row.id))throw new PortionError('Invalid portion reference.');ids.add(row.id);}
    return { ...(row.id===undefined?{}:{id:row.id as number}),name,price:Math.round(row.price*100)/100,isAvailable:row.isAvailable,isDefault:row.isDefault };
  });
}

export function availablePortions(options:PortionOption[]=[]){return options.filter(option=>option.isAvailable);}
export function defaultPortion(options:PortionOption[]=[]){const available=availablePortions(options);return available.find(option=>option.isDefault)??available[0];}
export function portionPrice(price:number,options:PortionOption[]=[]){
  const available=availablePortions(options),shown=available.length?available:options;
  const prices=shown.length?shown.map(option=>option.price):[price];
  return {price:Math.min(...prices),from:new Set(prices).size>1};
}
export function resolvePortion(item:{price:number;options:PortionOption[]},optionId:unknown){
  if(!item.options.length){if(optionId!=null)throw new PortionError('This portion was removed. Refresh your basket.');return {price:item.price,option:null};}
  const option=item.options.find(option=>option.id===optionId);
  if(!option||!option.isAvailable)throw new PortionError('Choose an available portion. Your basket has been kept.');
  return {price:option.price,option};
}
