export function profileInputError(body:Record<string,unknown>){
 if(Object.keys(body).some(k=>!['action','name','phone','currentPassword','newPassword'].includes(k)))return 'This profile field cannot be changed.';
 if(body.action==='profile'){
  if(typeof body.name!=='string'||body.name.trim().length<2||body.name.trim().length>100)return 'Use a name between 2 and 100 characters.';
  if(typeof body.phone!=='string'||body.phone.length>40||body.phone&&!/^[+\d\s().-]{5,40}$/.test(body.phone))return 'Enter a valid phone number, or leave it empty.';
 }
 if(body.action==='password'&&(typeof body.newPassword!=='string'||body.newPassword.length<10||body.newPassword.length>200))return 'Use a password between 10 and 200 characters.';
 return null;
}
