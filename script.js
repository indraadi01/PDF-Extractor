/* GitHub Pages-ready. Dependencies are loaded via CDN in index.html. */
'use strict';
const $ = id => document.getElementById(id);
const selected = [];
let busy = false;
let outputBlob = null;
let outputName = 'hasil_extract_gambar.zip';
const els = { input:$('fileInput'), drop:$('dropZone'), list:$('fileList'), count:$('fileCount'), dpi:$('dpi'), dpiLabel:$('dpiLabel'), convert:$('convertBtn'), progress:$('progressArea'), progressText:$('progressText'), progressPct:$('progressPct'), progressBar:$('progressBar'), progressDetail:$('progressDetail'), result:$('resultArea'), resultText:$('resultText'), download:$('downloadBtn'), error:$('errorArea') };
const formatSize = bytes => bytes < 1048576 ? `${(bytes/1024).toFixed(1)} KB` : `${(bytes/1048576).toFixed(1)} MB`;
const isPdf = file => file && (/\.pdf$/i.test(file.name) || file.type === 'application/pdf');
function setError(message){els.error.textContent=message;els.error.hidden=!message;}
function resetResult(){outputBlob=null;els.result.hidden=true;els.progress.hidden=true;setError('');}
function renderFiles(){els.list.replaceChildren();selected.forEach((file,index)=>{const row=document.createElement('div');row.className='file-entry';const emoji=document.createElement('span');emoji.className='file-emoji';emoji.textContent='📄';const info=document.createElement('div');info.className='file-info';const name=document.createElement('div');name.className='file-name';name.textContent=file.name;const size=document.createElement('div');size.className='file-size';size.textContent=formatSize(file.size);info.append(name,size);const remove=document.createElement('button');remove.className='remove-btn';remove.type='button';remove.textContent='×';remove.title='Hapus file';remove.setAttribute('aria-label',`Hapus ${file.name}`);remove.disabled=busy;remove.addEventListener('click',()=>{selected.splice(index,1);resetResult();renderFiles();});row.append(emoji,info,remove);els.list.append(row);});els.count.textContent=selected.length?`${selected.length} file dipilih`:'Belum ada file';els.convert.disabled=busy||selected.length===0;}
function addFiles(files){if(busy)return;let invalid=0;for(const file of files){if(!isPdf(file)){invalid++;continue;}if(!selected.some(f=>f.name===file.name&&f.size===file.size&&f.lastModified===file.lastModified))selected.push(file);}resetResult();renderFiles();if(invalid)setError(`${invalid} file dilewati karena bukan PDF.`);}
els.drop.addEventListener('click',()=>{if(!busy)els.input.click();});els.drop.addEventListener('keydown',event=>{if((event.key==='Enter'||event.key===' ')&&!busy){event.preventDefault();els.input.click();}});
els.input.addEventListener('change',event=>{addFiles([...event.target.files]);event.target.value='';});
for(const name of ['dragenter','dragover'])els.drop.addEventListener(name,event=>{event.preventDefault();if(!busy)els.drop.classList.add('drag-over');});
for(const name of ['dragleave','drop'])els.drop.addEventListener(name,event=>{event.preventDefault();els.drop.classList.remove('drag-over');});
els.drop.addEventListener('drop',event=>addFiles([...event.dataTransfer.files]));
els.dpi.addEventListener('input',()=>{els.dpiLabel.textContent=`${els.dpi.value} DPI`;});
function progress(pct,text,detail=''){const val=Math.max(0,Math.min(100,Math.round(pct)));els.progressBar.style.width=`${val}%`;els.progressPct.textContent=`${val}%`;els.progressText.textContent=text;els.progressDetail.textContent=detail;}
function canvasToPng(canvas){return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Gagal membuat PNG. Memori perangkat mungkin tidak cukup.')),'image/png'));}
function safeStem(name){return name.replace(/\.pdf$/i,'').replace(/[\\/<>:"|?*\x00-\x1f]/g,'_').trim()||'PDF';}
function uniquePath(path,used){if(!used.has(path)){used.add(path);return path;}const match=path.match(/^(.*)(\.png)$/i);let index=2;let candidate;do{candidate=`${match[1]}_${index}${match[2]}`;index++;}while(used.has(candidate));used.add(candidate);return candidate;}
async function convert(){if(busy||!selected.length)return;if(!window.pdfjsLib||!window.JSZip){setError('Library PDF.js atau JSZip gagal dimuat. Pastikan internet aktif lalu refresh halaman.');return;}busy=true;resetResult();renderFiles();els.dpi.disabled=true;els.progress.hidden=false;progress(0,'Membaca PDF…');let pageCount=0;let totalPages=0;const files=[...selected];const zip=new JSZip();const used=new Set();const dpi=Number(els.dpi.value);let completed=0;const failures=[];
try{pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
for(let i=0;i<files.length;i++){
 const file=files[i];let doc;
 try{const bytes=new Uint8Array(await file.arrayBuffer());doc=await pdfjsLib.getDocument({data:bytes,useSystemFonts:true}).promise;totalPages+=doc.numPages;
 for(let n=1;n<=doc.numPages;n++){
 const page=await doc.getPage(n);let canvas=null;
 try{const viewport=page.getViewport({scale:dpi/72});const pixelCount=viewport.width*viewport.height;
 if(pixelCount>65000000)throw new Error(`Halaman ${n} membutuhkan ${Math.round(pixelCount/1000000)} megapiksel. Turunkan DPI agar tidak kehabisan RAM.`);
 canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);const context=canvas.getContext('2d',{alpha:false});if(!context)throw new Error('Canvas tidak tersedia di browser ini.');
 await page.render({canvasContext:context,viewport,background:'white'}).promise;
 const png=await canvasToPng(canvas);const name=uniquePath(`${safeStem(file.name)} (${n}).png`,used);zip.file(name,png);completed++;pageCount++;progress(Math.min(89,5+84*(i+(n/doc.numPages))/files.length),'Mengonversi halaman…',`${file.name} · halaman ${n} dari ${doc.numPages}`);
 }finally{if(canvas){canvas.width=0;canvas.height=0;}page.cleanup();}
 }
 }catch(err){failures.push(`${file.name}: ${err.message||String(err)}`);}finally{if(doc)await doc.destroy();}
 }
 if(!completed)throw new Error(`Tidak ada gambar berhasil dibuat. ${failures.join(' | ')}`);
 progress(90,'Membuat file ZIP…',`${completed} gambar PNG selesai dibuat.`);
 outputBlob=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:3}},metadata=>progress(90+metadata.percent*.1,'Membuat file ZIP…',`${completed} gambar PNG siap diunduh.`));
 els.result.hidden=false;els.resultText.textContent=`${pageCount} halaman berhasil diekstrak dari ${files.length-failures.length} PDF. Ukuran ZIP: ${formatSize(outputBlob.size)}.${failures.length?` ${failures.length} PDF gagal, lihat pesan di bawah.`:''}`;
 progress(100,'Selesai!',`${completed} PNG berhasil dibuat.`);
 if(failures.length)setError('Beberapa PDF gagal diproses: '+failures.join(' | '));
 }catch(err){setError(`Konversi gagal: ${err.message||String(err)}`);els.progress.hidden=true;}
 finally{busy=false;els.dpi.disabled=false;renderFiles();}
}
els.convert.addEventListener('click',convert);
els.download.addEventListener('click',()=>{if(!outputBlob)return;const url=URL.createObjectURL(outputBlob);const link=document.createElement('a');link.href=url;link.download=outputName;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);});
renderFiles();
