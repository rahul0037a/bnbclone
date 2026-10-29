(() => {
  'use strict';
  const money = value => Number(value).toLocaleString('en-IN', {maximumFractionDigits:2});
  const round = value => Math.round((value + Number.EPSILON)*100)/100;
  const form=document.getElementById('booking-form');
  if(form) {
    const start=document.getElementById('checkInDate'), end=document.getElementById('checkOutDate'), rooms=document.getElementById('numberOfRooms');
    const update=()=> {
      const nights=(new Date(end.value+'T00:00:00Z')-new Date(start.value+'T00:00:00Z'))/86400000;
      const roomCount=Number(rooms.value);
      const valid=Number.isInteger(nights)&&nights>=1&&nights<=90&&Number.isInteger(roomCount)&&roomCount>=1;
      end.setCustomValidity(valid?'':'Choose a stay of 1 to 90 nights with valid room counts.');
      const subtotal=valid?round(Number(form.dataset.nightlyPrice)*nights*roomCount):0;
      const tax=round(subtotal*.18);
      document.getElementById('preview-nights').textContent=valid?nights:0;
      document.getElementById('preview-rooms').textContent=Number.isInteger(roomCount)?roomCount:0;
      document.getElementById('preview-subtotal').textContent=money(subtotal);
      document.getElementById('preview-gst').textContent=money(tax);
      document.getElementById('preview-total').textContent=money(round(subtotal+tax));
    };
    start.addEventListener('change',()=>{const next=new Date(start.value+'T00:00:00Z');if(!Number.isFinite(next.getTime()))return;next.setUTCDate(next.getUTCDate()+1);end.min=next.toISOString().slice(0,10);if(!end.value||end.value<=start.value)end.value=end.min;update();});
    end.addEventListener('change',update);rooms.addEventListener('input',update);update();
  }
  document.querySelectorAll('[data-copy-booking]').forEach(button=>button.addEventListener('click',async()=>{const status=document.getElementById('copy-status');try{await navigator.clipboard.writeText(button.dataset.copyBooking);status.textContent='Copied';}catch{status.textContent='Select the code to copy it.';}}));
  document.querySelectorAll('[data-print-receipt]').forEach(button=>button.addEventListener('click',()=>window.print()));
})();
