import {managedImageParts} from './upload-policy';
export function kitchenProfileError(body:Record<string,unknown>):string|null {
 if(typeof body.name!=='string'||body.name.trim().length<2||body.name.trim().length>100)return 'Kitchen name must contain 2–100 characters.';
 if(typeof body.deliveryFee!=='number'||!Number.isFinite(body.deliveryFee)||body.deliveryFee<0||body.deliveryFee>50)return 'Delivery fee must be between €0 and €50.';
 if(typeof body.estimatedMinutes!=='number'||!Number.isInteger(body.estimatedMinutes)||body.estimatedMinutes<10||body.estimatedMinutes>240)return 'Preparation time must be 10–240 whole minutes.';
 for(const [key,max] of [['description',1200],['phone',40]] as const)if(typeof body[key]==='string'&&body[key].length>max)return `${key==='phone'?'Phone number':'Description'} is too long.`;
 for(const key of ['logoUrl','coverImageUrl'])if(body[key]&&!managedImageParts(String(body[key]))){try{const u=new URL(String(body[key]));if(!['http:','https:'].includes(u.protocol)||String(body[key]).length>500)throw Error();}catch{return 'Image links must be valid HTTP or HTTPS URLs.';}}
 return null;
}
