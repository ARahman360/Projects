'use client';
/* eslint @next/next/no-img-element: off -- Blob previews cannot use the remote image optimizer. */
import {useEffect,useId,useRef,useState} from 'react';
import {IMAGE_ACCEPT,IMAGE_HELP,imageFileError,imageReferenceError} from '@/src/lib/upload-policy';
import MarketImage from './market-image';

export default function ImageUpload({name,label,initialValue='',disabled=false}:{name:string;label:string;initialValue?:string;disabled?:boolean}){
  const id=useId(),input=useRef<HTMLInputElement>(null),camera=useRef<HTMLInputElement>(null),xhr=useRef<XMLHttpRequest|null>(null);
  const [value,setValue]=useState(initialValue),[file,setFile]=useState<File|null>(null),[preview,setPreview]=useState(''),[error,setError]=useState(''),[status,setStatus]=useState(''),[progress,setProgress]=useState<number|null>(null),[drag,setDrag]=useState(false),[urlOpen,setUrlOpen]=useState(false);
  const uploading=progress!==null;
  useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview);},[preview]);
  useEffect(()=>()=>xhr.current?.abort(),[]);
  useEffect(()=>{input.current?.setCustomValidity(file?'Confirm the image upload before saving, or discard this selection.':error);},[file,error]);
  function dirty(){input.current?.dispatchEvent(new Event('change',{bubbles:true}));}
  function choose(selected?:File){if(!selected)return;const invalid=imageFileError(selected);setError(invalid??'');setStatus('');if(invalid){setFile(null);setPreview('');return;}setFile(selected);setPreview(URL.createObjectURL(selected));dirty();}
  function discard(){setFile(null);setPreview('');setError('');setStatus('Selection discarded. Your saved image is unchanged.');if(input.current)input.current.value='';if(camera.current)camera.current.value='';}
  function upload(){if(!file||uploading)return;setError('');setProgress(0);setStatus('Uploading image…');const request=new XMLHttpRequest();xhr.current=request;request.open('POST','/api/uploads');request.timeout=90000;request.setRequestHeader('Content-Type',file.type||'application/octet-stream');
    request.upload.onprogress=e=>{if(e.lengthComputable)setProgress(Math.round(e.loaded/e.total*100));};
    request.onload=()=>{setProgress(null);let data:{imageUrl?:string;error?:string}={};try{data=JSON.parse(request.responseText);}catch{}if(request.status===201&&data.imageUrl){setValue(data.imageUrl);setFile(null);setPreview('');setStatus('Upload complete. Save your changes to use this image.');if(input.current)input.current.value='';dirty();}else{setError(data.error||'Upload failed. Try again.');setStatus('');}};
    request.onerror=request.ontimeout=()=>{setProgress(null);setError('Upload failed. Check your connection and try again. Your other changes are still here.');setStatus('');};
    request.onabort=()=>{setProgress(null);setStatus('Upload cancelled. You can retry.');};request.send(file);
  }
  return <section className="image-upload" aria-labelledby={`${id}-label`} aria-busy={uploading}>
    <strong id={`${id}-label`}>{label}</strong><input type="hidden" name={name} value={value}/>
    <div className={`image-drop ${drag?'is-dragging':''}`} onDragOver={e=>{e.preventDefault();if(!disabled&&!uploading)setDrag(true);}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false);if(!disabled&&!uploading){if(e.dataTransfer.files.length!==1)setError('Please choose one image at a time.');else choose(e.dataTransfer.files[0]);}}}>
      {file&&preview?<img className="image-preview" src={preview} alt={`Preview of ${label.toLowerCase()}`} onError={()=>setError('This image cannot be previewed. Choose another JPG, PNG or WebP image.')}/>:value?<MarketImage src={value} alt={label} className="image-preview"/>:<svg className="upload-icon" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="3" y="3" width="26" height="26" rx="6"/><circle cx="11" cy="11" r="3"/><path d="m4 24 9-8 5 4 5-7 6 10"/></svg>}
      <p>{drag?'Drop image here':file?file.name:'Drag & drop an image, or choose from your device'}</p>
      <div className="image-actions"><button type="button" disabled={disabled||uploading} onClick={()=>input.current?.click()}>{file||value?'Replace image':'Upload image'}</button><button type="button" disabled={disabled||uploading} onClick={()=>camera.current?.click()}>Take photo</button></div>
      <input className="upload-file-input" ref={input} id={id} type="file" accept={IMAGE_ACCEPT} aria-label={`Choose ${label.toLowerCase()}`} aria-describedby={`${id}-help ${id}-error`} aria-invalid={Boolean(error)} disabled={disabled} onChange={e=>{if(!uploading)choose(e.target.files?.[0]);}}/>
      <input className="upload-file-input" ref={camera} type="file" accept={IMAGE_ACCEPT} capture="environment" aria-label={`Take photo for ${label.toLowerCase()}`} disabled={disabled||uploading} onChange={e=>choose(e.target.files?.[0])}/>
      <small id={`${id}-help`}>{IMAGE_HELP} Camera choices depend on your device. If access is denied, use Choose Photo or allow access in browser settings.</small>
    </div>
    {(file||error)&&<div className="image-actions"><button type="button" className="image-confirm" disabled={!file||disabled||uploading||Boolean(error)&&!error.startsWith('Upload failed')} onClick={upload}>{error.startsWith('Upload failed')?'Retry upload':'Confirm & upload'}</button><button type="button" disabled={disabled||uploading} onClick={discard}>Discard selection</button></div>}
    {uploading&&<div role="status"><progress max={100} value={progress??0} aria-label={`${label} upload progress`}/><span>{progress===100?'Processing image…':`Uploading image… ${progress}%`}</span><button type="button" onClick={()=>xhr.current?.abort()}>Cancel upload</button></div>}
    {!file&&value&&<button type="button" disabled={disabled||uploading} onClick={()=>{if(window.confirm(`Remove ${label.toLowerCase()}? This takes effect when you save.`)){setValue('');setError('');setStatus('Image removed from this draft. Save to confirm.');dirty();}}}>Remove image</button>}
    <p role="status" className="image-status">{status}</p>{error&&<p id={`${id}-error`} role="alert" className="image-error">{error}</p>}
    <button type="button" className="image-url-toggle" disabled={disabled||uploading||Boolean(file)} aria-expanded={urlOpen} onClick={()=>setUrlOpen(!urlOpen)}>Use image URL instead</button>
    {urlOpen&&<label>Image URL<input type="text" inputMode="url" value={value} maxLength={500} disabled={disabled||uploading} onChange={e=>{setValue(e.target.value);setError(imageReferenceError(e.target.value)??'');setStatus('');dirty();}} placeholder="https://…"/><small>Use a direct image link, not a Google search or sharing page.</small></label>}
  </section>;
}
