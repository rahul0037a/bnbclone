(() => {
  'use strict';
  const storage = { get(key) { try { return localStorage.getItem(key); } catch (_) { return null; } }, set(key,value) { try { localStorage.setItem(key,value); return true; } catch (_) { return false; } } };
  let saved = [];
  try { const value = JSON.parse(storage.get('wanderlust-saved') || '[]'); if(Array.isArray(value)) saved = [...new Set(value.filter(id => typeof id === 'string' && /^[a-f\d]{24}$/i.test(id)))].slice(0,100); } catch (_) {}
  const pendingButtons = new Map(); let toastTimer;
  const toast = message => { const el=document.getElementById('site-toast'); if(!el)return; el.textContent=message;el.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{el.hidden=true;},3000); };
  const savedQuery = () => saved.length?saved.join(','):'000000000000000000000000';
  const syncSaved = () => {
    document.querySelectorAll('[data-saved-count]').forEach(el=>{el.textContent=String(saved.length);});
    document.querySelectorAll('[data-saved-nav]').forEach(el=>{el.href='/listings?saved='+encodeURIComponent(savedQuery());});
    document.querySelectorAll('[data-save-id]').forEach(button=>{const active=saved.includes(button.dataset.saveId);button.setAttribute('aria-pressed',String(active));button.setAttribute('aria-label',(active?'Unsave ':'Save ')+(button.dataset.saveTitle || 'this stay'));const icon=button.querySelector('i');if(icon)icon.className=active?'fa-solid fa-heart':'fa-regular fa-heart';});
  };
  const themeButton=document.getElementById('theme-toggle-btn');
  const syncTheme=()=>{const dark=document.documentElement.dataset.bsTheme==='dark';const icon=document.getElementById('theme-toggle-icon');if(icon)icon.className=dark?'fa-regular fa-sun':'fa-regular fa-moon';if(themeButton)themeButton.setAttribute('aria-label',dark?'Switch to light theme':'Switch to dark theme');};
  syncTheme();
  themeButton?.addEventListener('click',()=>{const theme=document.documentElement.dataset.bsTheme==='dark'?'light':'dark';document.documentElement.dataset.bsTheme=theme;storage.set('theme',theme);syncTheme();});
  syncSaved();
  document.querySelectorAll('[data-save-id]').forEach(button=>button.addEventListener('click',()=>{
    const id=button.dataset.saveId;if(!/^[a-f\d]{24}$/i.test(id))return;
    const exists=saved.includes(id);if(!exists&&saved.length>=100){toast('You can save up to 100 stays. Remove one to add another.');return;}
    saved=exists?saved.filter(item=>item!==id):[...saved,id];const persisted=storage.set('wanderlust-saved',JSON.stringify(saved));syncSaved();toast(persisted?(exists?'Stay removed from your saved list':'Stay saved on this device'):'Saved for this visit. Browser storage is unavailable.');
    if(exists&&new URLSearchParams(location.search).has('saved')){const url=new URL(location.href);url.searchParams.set('saved',savedQuery());url.searchParams.delete('page');location.assign(url.pathname+url.search);}
  }));
  document.querySelectorAll('[data-saved-filter]').forEach(button=>button.addEventListener('click',()=>{const url=new URL(location.href);if(url.searchParams.has('saved'))url.searchParams.delete('saved');else url.searchParams.set('saved',savedQuery());url.searchParams.delete('page');location.assign(url.pathname+url.search);}));
  document.querySelectorAll('[data-tax-toggle]').forEach(toggle=>toggle.addEventListener('change',()=>{document.querySelectorAll('[data-price]').forEach(el=>{const base=Number(el.dataset.price)||0;const tax=Math.round(base*.18*100)/100;const amount=toggle.checked?Math.round((base+tax)*100)/100:base;el.textContent='₹'+amount.toLocaleString('en-IN',{maximumFractionDigits:2});});}));
  document.querySelectorAll('form.needs-validation').forEach(form=>form.addEventListener('submit',event=>{if(!form.checkValidity()){event.preventDefault();event.stopPropagation();form.classList.add('was-validated');form.querySelector(':invalid')?.focus();return;}form.classList.add('was-validated');if(form.method.toLowerCase()==='post'){const button=form.querySelector('button[type="submit"],button:not([type])');if(button){pendingButtons.set(button,Array.from(button.childNodes).map(node=>node.cloneNode(true)));button.disabled=true;button.setAttribute('aria-busy','true');const label=document.createElement('span');label.textContent='Please wait…';button.replaceChildren(label);}}}));
  document.querySelectorAll('img').forEach(img=>img.addEventListener('error',()=>{img.classList.add('photo-load-error');img.alt=img.alt || 'Photo unavailable';}));
  const catalogForm=document.getElementById('catalog-filter-form');
  if(catalogForm){const checkIn=document.getElementById('filter-checkin');const checkOut=document.getElementById('filter-checkout');const validateDates=()=>{checkIn.setCustomValidity('');checkOut.setCustomValidity('');if(checkIn.value&&!checkOut.value)checkOut.setCustomValidity('Choose a check-out date, or clear check-in.');else if(checkOut.value&&!checkIn.value)checkIn.setCustomValidity('Choose a check-in date, or clear check-out.');else if(checkIn.value&&checkOut.value&&checkOut.value<=checkIn.value)checkOut.setCustomValidity('Check-out must be after check-in.');};checkIn.addEventListener('change',validateDates);checkOut.addEventListener('change',validateDates);catalogForm.addEventListener('submit',event=>{validateDates();if(!catalogForm.reportValidity())event.preventDefault();});}
  window.addEventListener('pageshow',()=>{document.querySelectorAll('button[aria-busy="true"]').forEach(button=>{button.disabled=false;button.removeAttribute('aria-busy');if(pendingButtons.has(button)){button.replaceChildren(...pendingButtons.get(button));pendingButtons.delete(button);}});});
})();
