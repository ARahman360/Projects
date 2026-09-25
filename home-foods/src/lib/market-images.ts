import manifest from "../data/image-manifest.json";
const stored=manifest as Record<string,string>;
export function localImage(src:string|null|undefined){
  if(!src)return null;
  if(stored[src])return stored[src];
  if(src.startsWith("/media/"))return src;
  try {const url=new URL(src);if(url.hostname==="images.unsplash.com"){
    const found=Object.keys(stored).find(key=>new URL(key).pathname===url.pathname);if(found)return stored[found];
  }
  // The old random-image service is unavailable. Do not keep making failing requests.
  if(url.hostname==="loremflickr.com")return null;
  if(!["https:","http:","data:"].includes(url.protocol))return null;
  }catch{if(!src.startsWith("/")||src.startsWith("//"))return null;}
  return src;
}
export function foodIllustration(description:string){
  const text=description.toLowerCase();
  const kind=/kitchen|restaurant|chef/.test(text)?"kitchen":/pizza|flatbread/.test(text)?"pizza":/tea|coffee|soda|juice|drink|lassi/.test(text)?"drink":/cake|dessert|sweet|ice cream|pudding|rosogolla|halwa/.test(text)?"dessert":/salad|vegetarian|vegan|vegetable/.test(text)?"vegetarian":"meal";
  return `/media/${kind}-illustration.svg`;
}
