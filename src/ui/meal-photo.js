/**
 * Compress a user-chosen meal image before saving it with the local day log.
 * Keeps imports/exports offline-safe, capped, and avoids storing multi-MB
 * camera originals in IndexedDB. Never uploads a file or infers nutrition.
 */
export async function compressMealPhoto(file,{maxDimension=640,maxCharacters=180000}={}) {
  if(!file||typeof file.size!=='number')throw new Error('Select an image first.')
  if(file.size>30*1024*1024)throw new Error('Photo is too large. Choose a smaller image.')
  if(!file.type.startsWith('image/')&&!/\.hei[cf]$/i.test(file.name??''))
    throw new Error('Choose an image file.')
  const url=URL.createObjectURL(file)
  try {
    const img=new Image()
    await new Promise((resolve,reject)=>{
      img.onload=resolve
      img.onerror=()=>reject(new Error('This photo format could not be opened. Try a JPEG or PNG.'))
      img.src=url
    })
    if(!img.naturalWidth||!img.naturalHeight)throw new Error('Photo is empty.')
    const scale=Math.min(1,maxDimension/Math.max(img.naturalWidth,img.naturalHeight))
    const canvas=document.createElement('canvas')
    canvas.width=Math.max(1,Math.round(img.naturalWidth*scale))
    canvas.height=Math.max(1,Math.round(img.naturalHeight*scale))
    const ctx=canvas.getContext('2d')
    if(!ctx)throw new Error('Photo processing is unavailable.')
    ctx.drawImage(img,0,0,canvas.width,canvas.height)
    let encoded=''
    for(const quality of [.78,.65,.52,.4]){
      encoded=canvas.toDataURL('image/jpeg',quality)
      if(encoded.length<=maxCharacters)break
    }
    if(!encoded.startsWith('data:image/jpeg;base64,')||encoded.length>maxCharacters)
      throw new Error('Photo is too detailed to store. Try a smaller crop.')
    return encoded
  } finally {URL.revokeObjectURL(url)}
}
