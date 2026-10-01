'use client';
import {useState, type FormEvent} from 'react';
import ImageUpload from './image-upload';
import MarketImage from './market-image';
type Row=Record<string,unknown>;
export default function SellerCategoryManager({categories,items,busy,save,remove}:{categories:Row[];items:Row[];busy:boolean;save:(body:Row,isNew:boolean)=>Promise<boolean>;remove:(category:Row)=>void}){
 const [editing,setEditing]=useState<Row|null>(null);
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(!editing)return;
  const form=new FormData(event.currentTarget);
  if(await save({categoryId:editing.id,name:String(form.get('name')??'').trim(),description:String(form.get('description')??'').trim(),imageUrl:String(form.get('imageUrl')??'')},!editing.id))setEditing(null);
 }
 return <section className="seller-category-manager" aria-labelledby="categories-heading">
  <div className="workspace-section-heading"><div><h3 id="categories-heading">Menu categories</h3><p>Keep your menu easy to explore.</p></div><button type="button" disabled={busy} aria-expanded={editing!==null} onClick={()=>setEditing({})}>+ Add category</button></div>
  {editing&&<form key={String(editing.id??'new')} className="workspace-form compact-category-editor" onSubmit={submit}>
   <h4>{editing.id?'Edit category':'New category'}</h4><label>Category name<input name="name" required minLength={2} maxLength={80} defaultValue={String(editing.name??'')} autoFocus/></label><label>Short description<input name="description" maxLength={300} defaultValue={String(editing.description??'')}/></label>
   <ImageUpload name="imageUrl" label="Category image" initialValue={String(editing.imageUrl??'')} disabled={busy}/>
   <div className="workspace-actions"><button className="dark-cta" disabled={busy}>{busy?'Saving…':'Save category'}</button><button type="button" disabled={busy} onClick={()=>setEditing(null)}>Cancel</button></div>
  </form>}
  <div className="category-compact-list">{categories.map(category=><article className="category-compact-row" key={String(category.id)}>
   <MarketImage src={String(category.imageUrl??'')} alt={String(category.name)}/><div><h4>{String(category.name)}</h4><small>{items.filter(item=>item.categoryId===category.id).length} dishes</small>{Boolean(category.description)&&<p>{String(category.description)}</p>}</div>
   <div className="workspace-actions"><button type="button" disabled={busy} aria-label={`Edit ${String(category.name)} category`} onClick={()=>setEditing(category)}>Edit</button><button type="button" disabled={busy} aria-label={`Remove ${String(category.name)} category`} onClick={()=>remove(category)}>Remove</button></div>
  </article>)}</div>{!categories.length&&!editing&&<p className="workspace-muted">Add a category to organise your dishes.</p>}
 </section>;
}
