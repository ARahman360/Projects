"use client";
/* eslint @next/next/no-img-element: off -- Native img keeps browser lazy loading and supports arbitrary seeded image URLs. */

import { useState } from "react";
import { localImage, foodIllustration } from "@/src/lib/market-images";

export default function MarketImage({ src, alt, className = "", fallbackSrc, eager = false }: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  fallbackSrc?: string;
  eager?: boolean;
}) {
  return <ImageWithFallback key={`${src}|${fallbackSrc}`} src={src} alt={alt} className={className} fallbackSrc={fallbackSrc} eager={eager}/>;
}

function ImageWithFallback({src,alt,className,fallbackSrc,eager}:{src:string|null|undefined;alt:string;className:string;fallbackSrc?:string;eager:boolean}){
  const [index,setIndex]=useState(0);
  const options=[...new Set([localImage(src),localImage(fallbackSrc),foodIllustration(alt)].filter((value):value is string=>Boolean(value)))];
  const current=options[Math.min(index,options.length-1)];
  const illustration=current.endsWith("-illustration.svg");
  return <img className={className} src={current} alt={illustration?`Food illustration: ${alt}`:alt} title={illustration?"Illustration — kitchen photo not available":undefined} loading={eager?"eager":"lazy"} decoding="async" fetchPriority={eager?"high":"auto"} onError={()=>{if(index<options.length-1)setIndex(index+1);}}/>;
}
