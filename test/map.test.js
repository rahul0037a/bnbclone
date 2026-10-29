const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
test('listing popup treats hostile property text as text rather than HTML', () => {
    const attack = '<img src=x onerror=ALERT_SENTINEL>';
    function element() { return {children:[],textContent:'',style:{},append(...nodes){this.children.push(...nodes);},replaceChildren(){this.children=[];},set innerHTML(value){throw new Error('HTML insertion is forbidden');}}; }
    const map=element();map.dataset={lat:'15.5',lng:'73.8',title:attack,location:attack,country:'India'};
    let popup;
    const context={document:{getElementById:id=>id==='map'?map:null,createElement:element},window:{},Number,AbortSignal,requestAnimationFrame:fn=>fn(),L:{map:()=>({setView(){return this;}}),tileLayer:()=>({addTo(){return this;}}),marker:()=>({addTo(){return this;},bindPopup(node){popup=node;return this;}})}};
    vm.runInNewContext(fs.readFileSync(require.resolve('../public/js/map.js'),'utf8'),context);
    assert.ok(popup && typeof popup==='object');
    assert.equal(popup.children[0].textContent,attack);
    assert.equal(popup.children[1].textContent,attack+', India');
});
