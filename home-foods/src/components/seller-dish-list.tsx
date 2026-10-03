'use client';

import {useEffect,useRef,useState,type FormEvent} from 'react';
import PortionEditor from './portion-editor';
import {portionPrice,type PortionDraft,type PortionOption} from '@/src/lib/portion-options';
import ImageUpload from './image-upload';
import MarketImage from './market-image';
import {OriginButton} from './ui/origin-button';
import OverlayLayer from './overlay-layer';

type Row=Record<string,unknown>;
type Props={items:Row[];categories:Row[];busy:boolean;save:(body:Row,isNew:boolean)=>Promise<boolean>;remove:(item:Row)=>void};
const text=(value:unknown)=>String(value??'');
const dishPrice=(item:Row)=>{const value=portionPrice(Number(item.price),item.options as PortionOption[]??[]);return (value.from?'From ':'')+money(value.price);};
const money=(value:unknown)=>new Intl.NumberFormat('fi-FI',{style:'currency',currency:'EUR'}).format(Number(value??0));

export default function SellerDishList({items,categories,busy,save,remove}:Props){
  const [expanded,setExpanded]=useState<number|'new'|null>(null),[dirty,setDirty]=useState(false);
  const addButton=useRef<HTMLButtonElement>(null);
  const discardDialog=useRef<HTMLDivElement>(null);
  const [pendingNext,setPendingNext]=useState<number|'new'|null>(null);
  const activeDirty=dirty&&(expanded==='new'||items.some(item=>Number(item.id)===expanded));
  useEffect(()=>{
    if(!activeDirty)return;
    const unload=(event:BeforeUnloadEvent)=>event.preventDefault();
    const click=(event:MouseEvent)=>{const link=(event.target as Element)?.closest('a');if(link?.href&&new URL(link.href).pathname!==location.pathname&&!window.confirm('Leave without saving your dish changes?')){event.preventDefault();event.stopPropagation();}};
    const signout=(event:Event)=>{if(!window.confirm('Sign out without saving your dish changes?'))event.preventDefault();};
    window.addEventListener('beforeunload',unload);document.addEventListener('click',click,true);window.addEventListener('homefoods:before-signout',signout);
    return()=>{window.removeEventListener('beforeunload',unload);document.removeEventListener('click',click,true);window.removeEventListener('homefoods:before-signout',signout);};
  },[activeDirty]);
  function toggle(next:number|'new'){
    if(busy)return;
    if(activeDirty){setPendingNext(next);return;}
    setDirty(false);setExpanded(current=>current===next?null:next);
  }
  async function submit(body:Row,isNew:boolean){
    if(await save(body,isNew)){setDirty(false);setExpanded(null);requestAnimationFrame(()=>{if(isNew)addButton.current?.focus();else document.getElementById(`dish-toggle-${body.itemId}`)?.focus();});}
  }
  return <section className="seller-menu-list seller-dish-list" aria-labelledby="seller-dishes-heading">
    <div className="workspace-section-heading"><div><h3 id="seller-dishes-heading">Your dishes</h3><p>{items.length} {items.length===1?'dish':'dishes'} · Select a dish to edit</p></div><button className="dark-cta seller-add-dish" type="button" ref={addButton} disabled={busy} aria-expanded={expanded==='new'} aria-controls="dish-editor-new" onClick={()=>toggle('new')}>+ Add Dish</button></div>
    {expanded==='new'&&<div id="dish-editor-new" className="dish-editor-panel"><h4>Add a dish</h4><DishForm key="new" categories={categories} busy={busy} onDirty={()=>setDirty(true)} onSave={body=>submit(body,true)} onCancel={()=>toggle('new')}/></div>}
    <div className="dish-compact-list">{items.map(item=>{const id=Number(item.id),open=expanded===id,options=(item.options as PortionOption[]??[]),available=Boolean(item.isAvailable)&&(!options.length||options.some(option=>option.isAvailable));return <article className={`dish-compact-card${open?' is-open':''}`} key={id}>
      <h4><button type="button" className="dish-summary" id={`dish-toggle-${id}`} aria-expanded={open} aria-controls={`dish-editor-${id}`} disabled={busy} onClick={()=>toggle(id)}>
        <MarketImage src={text(item.imageUrl)} alt="" className="dish-thumbnail"/>
        <span className="dish-summary-name"><strong>{text(item.name)}</strong><small>{text(categories.find(category=>Number(category.id)===Number(item.categoryId))?.name)||'No category'}</small></span>
        <span className="dish-summary-price">{dishPrice(item)}</span><span className="dish-availability" data-available={available}>{available?'Available':'Unavailable'}</span><span className="dish-expand-label">{open?'Close':'Edit'} <span aria-hidden="true">{open?'⌃':'⌄'}</span></span>
      </button></h4>
      {open&&<div id={`dish-editor-${id}`} className="dish-editor-panel" role="region" aria-labelledby={`dish-toggle-${id}`}><DishForm key={id} item={item} categories={categories} busy={busy} onDirty={()=>setDirty(true)} onSave={body=>submit(body,false)} onCancel={()=>toggle(id)} onRemove={()=>remove(item)}/></div>}
    </article>;})}</div>
    {!items.length&&expanded!=='new'&&<p className="workspace-muted">Your menu is empty. Add your first dish to get started.</p>}
    {activeDirty&&<p className="dish-draft-note" role="status">Unsaved dish changes</p>}
    <OverlayLayer open={pendingNext!==null} onClose={()=>setPendingNext(null)} dialogRef={discardDialog} label="Unsaved dish changes" className="auth-overlay" dialogClassName="ops-confirm">
      <h2>Discard unsaved dish changes?</h2><p>Your edits have not been saved.</p><div className="workspace-actions"><button type="button" onClick={()=>setPendingNext(null)}>Keep editing</button><button type="button" onClick={()=>{setDirty(false);setExpanded(current=>current===pendingNext?null:pendingNext);setPendingNext(null);}}>Discard changes</button></div>
    </OverlayLayer>
  </section>;
}

function DishForm({item,categories,busy,onDirty,onSave,onCancel,onRemove}:{item?:Row;categories:Row[];busy:boolean;onDirty:()=>void;onSave:(body:Row)=>Promise<void>;onCancel:()=>void;onRemove?:()=>void}){
  const form=useRef<HTMLFormElement>(null);
  const [options,setOptions]=useState<PortionDraft[]>((item?.options as PortionDraft[])??[]);
  // Capture native change events too: the existing uploader emits these when its
  // hidden image reference changes after upload/removal.
  useEffect(()=>{const node=form.current;if(!node)return;node.addEventListener('input',onDirty);node.addEventListener('change',onDirty);return()=>{node.removeEventListener('input',onDirty);node.removeEventListener('change',onDirty);};},[onDirty]);
  async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();if(busy)return;const data=new FormData(event.currentTarget);await onSave({...(item?{itemId:item.id}:{}),name:text(data.get('name')).trim(),description:text(data.get('description')).trim(),price:options.length?(options.find(option=>option.isDefault)?.price??options[0].price):Number(data.get('price')),imageUrl:text(data.get('imageUrl')).trim(),categoryId:data.get('categoryId')?Number(data.get('categoryId')):null,isAvailable:data.get('isAvailable')==='on',options});}
  return <form ref={form} className="seller-dish-editor dish-edit-form" aria-label={item?`Edit ${text(item.name)}`:'Add a dish'} onSubmit={submit}>
    <label>Dish name<input name="name" required minLength={2} maxLength={100} defaultValue={text(item?.name)} placeholder="e.g. Sunday roast chicken"/></label>
    <label>Description<input name="description" maxLength={1000} defaultValue={text(item?.description)} placeholder="What makes it lovely?"/></label>
    <div className="seller-dish-fields">{!options.length&&<label>Price (€)<input name="price" type="number" step="0.01" min="0.5" max="500" required defaultValue={item?text(item.price):''}/></label>}<label>Category<select name="categoryId" defaultValue={text(item?.categoryId)}><option value="">No category</option>{categories.map(category=><option key={text(category.id)} value={text(category.id)}>{text(category.name)}</option>)}</select></label></div>
    <PortionEditor options={options} disabled={busy} onChange={value=>{setOptions(value);onDirty();}}/>
    <ImageUpload name="imageUrl" label="Dish image" initialValue={text(item?.imageUrl)} disabled={busy}/>
    <label className="seller-availability"><input type="checkbox" name="isAvailable" defaultChecked={item?Boolean(item.isAvailable):true}/> Available to order</label>
    <div className="workspace-actions"><OriginButton type="submit" loading={busy} loadingText="Saving…">{item?'Save dish':'Add dish'}</OriginButton><button type="button" disabled={busy} onClick={onCancel}>Cancel</button>{onRemove&&<button type="button" className="confirm-danger" disabled={busy} onClick={onRemove}>Remove dish</button>}</div>
  </form>;
}
