(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,50427,e=>{"use strict";var t=e.i(86322),i=e.i(94579);e.i(98913);var r=e.i(10303),s=e.i(77329);let a=(0,i.createContext)(void 0);function n({children:e}){let[n,o]=(0,i.useState)(null),[l,c]=(0,i.useState)(!0);(0,i.useEffect)(()=>{let e=(0,r.onAuthStateChanged)(s.auth,e=>{o(e),c(!1)});return()=>e()},[]);let u=async()=>{await (0,r.signOut)(s.auth)};return(0,t.jsx)(a.Provider,{value:{user:n,loading:l,logout:u},children:!l&&e})}e.s(["AuthProvider",()=>n,"useAuth",0,()=>{let e=(0,i.useContext)(a);if(!e)throw Error("useAuth must be used within an AuthProvider");return e}])},12088,e=>{"use strict";var t=e.i(94579);let i=e=>{let t=e.replace(/^([A-Z])|[\s-_]+(\w)/g,(e,t,i)=>i?i.toUpperCase():t.toLowerCase());return t.charAt(0).toUpperCase()+t.slice(1)},r=(...e)=>e.filter((e,t,i)=>!!e&&""!==e.trim()&&i.indexOf(e)===t).join(" ").trim();var s={xmlns:"http://www.w3.org/2000/svg",width:24,height:24,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2,strokeLinecap:"round",strokeLinejoin:"round"};let a=(0,t.forwardRef)(({color:e="currentColor",size:i=24,strokeWidth:a=2,absoluteStrokeWidth:n,className:o="",children:l,iconNode:c,...u},d)=>(0,t.createElement)("svg",{ref:d,...s,width:i,height:i,stroke:e,strokeWidth:n?24*Number(a)/Number(i):a,className:r("lucide",o),...!l&&!(e=>{for(let t in e)if(t.startsWith("aria-")||"role"===t||"title"===t)return!0})(u)&&{"aria-hidden":"true"},...u},[...c.map(([e,i])=>(0,t.createElement)(e,i)),...Array.isArray(l)?l:[l]])),n=(e,s)=>{let n=(0,t.forwardRef)(({className:n,...o},l)=>(0,t.createElement)(a,{ref:l,iconNode:s,className:r(`lucide-${i(e).replace(/([a-z0-9])([A-Z])/g,"$1-$2").toLowerCase()}`,`lucide-${e}`,n),...o}));return n.displayName=i(e),n};e.s(["default",()=>n],12088)},37201,e=>{"use strict";var t=e.i(86322),i=e.i(94579);let r=(0,i.createContext)(void 0);function s({children:e}){let[s,a]=(0,i.useState)("light");return(0,i.useEffect)(()=>{"dark"!==localStorage.theme&&("theme"in localStorage||!window.matchMedia("(prefers-color-scheme: dark)").matches)?(a("light"),document.documentElement.classList.remove("dark")):(a("dark"),document.documentElement.classList.add("dark"))},[]),(0,t.jsx)(r.Provider,{value:{theme:s,toggleTheme:()=>{let e="light"===s?"dark":"light";a(e),"dark"===e?(document.documentElement.classList.add("dark"),localStorage.theme="dark"):(document.documentElement.classList.remove("dark"),localStorage.theme="light")}},children:e})}e.s(["ThemeProvider",()=>s,"useTheme",0,()=>{let e=(0,i.useContext)(r);if(!e)throw Error("useTheme must be used within a ThemeProvider");return e}])},7476,e=>{"use strict";var t=e.i(86322),i=e.i(94579);let r=(0,i.createContext)(void 0);function s({children:e}){let[s,a]=(0,i.useState)(!1);return(0,i.useEffect)(()=>{"true"===localStorage.getItem("isAdminMode")&&a(!0)},[]),(0,t.jsx)(r.Provider,{value:{isAdmin:s,enableAdmin:()=>{a(!0),localStorage.setItem("isAdminMode","true")},disableAdmin:()=>{a(!1),localStorage.removeItem("isAdminMode")}},children:e})}e.s(["AdminProvider",()=>s,"useAdmin",0,()=>{let e=(0,i.useContext)(r);if(!e)throw Error("useAdmin must be used within an AdminProvider");return e}])},72594,e=>{"use strict";e.i(25874);var t=e.i(83925),i=e.i(77329);let r="notifications";e.s(["notificationService",0,{async send(e){e.recipientId!==e.senderId&&await (0,t.addDoc)((0,t.collection)(i.db,r),{...e,read:!1,createdAt:t.Timestamp.now()})},subscribe(e,s){let a=(0,t.query)((0,t.collection)(i.db,r),(0,t.where)("recipientId","==",e),(0,t.orderBy)("createdAt","desc"),(0,t.limit)(20));return(0,t.onSnapshot)(a,e=>{s(e.docs.map(e=>({id:e.id,...e.data(),createdAt:e.data().createdAt?.toDate()})))})},async markAsRead(e){let s=(0,t.doc)(i.db,r,e);await (0,t.updateDoc)(s,{read:!0})},async markAllAsRead(e){let s=(0,t.query)((0,t.collection)(i.db,r),(0,t.where)("recipientId","==",e),(0,t.where)("read","==",!1)),a=await (0,t.getDocs)(s),n=(0,t.writeBatch)(i.db);a.docs.forEach(e=>{n.update(e.ref,{read:!0})}),await n.commit()},async markChatNotificationsAsRead(e,s){let a=(0,t.query)((0,t.collection)(i.db,r),(0,t.where)("recipientId","==",e),(0,t.where)("senderId","==",s),(0,t.where)("type","==","chat"),(0,t.where)("read","==",!1)),n=await (0,t.getDocs)(a);if(n.empty)return;let o=(0,t.writeBatch)(i.db);n.docs.forEach(e=>{o.update(e.ref,{read:!0})}),await o.commit()},async saveFCMToken(e,r){let s=(0,t.doc)(i.db,"fcmTokens",e,"tokens",r);await (0,t.setDoc)(s,{token:r,createdAt:t.Timestamp.now(),userAgent:"u">typeof navigator?navigator.userAgent:"unknown"})},async deleteFCMToken(e,r){let s=(0,t.doc)(i.db,"fcmTokens",e,"tokens",r);await (0,t.deleteDoc)(s)},async getFCMTokens(e){let r=(0,t.collection)(i.db,"fcmTokens",e,"tokens");return(await (0,t.getDocs)(r)).docs.map(e=>e.data().token)}}])},5207,e=>{"use strict";let t,i;var r,s=e.i(94579);let a={data:""},n=/(?:([\u0080-\uFFFF\w-%@]+) *:? *([^{;]+?);|([^;}{]*?) *{)|(}\s*)/g,o=/\/\*[^]*?\*\/|  +/g,l=/\n+/g,c=(e,t)=>{let i="",r="",s="";for(let a in e){let n=e[a];"@"==a[0]?"i"==a[1]?i=a+" "+n+";":r+="f"==a[1]?c(n,a):a+"{"+c(n,"k"==a[1]?"":t)+"}":"object"==typeof n?r+=c(n,t?t.replace(/([^,])+/g,e=>a.replace(/([^,]*:\S+\([^)]*\))|([^,])+/g,t=>/&/.test(t)?t.replace(/&/g,e):e?e+" "+t:t)):a):null!=n&&(a=/^--/.test(a)?a:a.replace(/[A-Z]/g,"-$&").toLowerCase(),s+=c.p?c.p(a,n):a+":"+n+";")}return i+(t&&s?t+"{"+s+"}":s)+r},u={},d=e=>{if("object"==typeof e){let t="";for(let i in e)t+=i+d(e[i]);return t}return e};function h(e){let t,i,r=this||{},s=e.call?e(r.p):e;return((e,t,i,r,s)=>{var a;let h=d(e),p=u[h]||(u[h]=(e=>{let t=0,i=11;for(;t<e.length;)i=101*i+e.charCodeAt(t++)>>>0;return"go"+i})(h));if(!u[p]){let t=h!==e?e:(e=>{let t,i,r=[{}];for(;t=n.exec(e.replace(o,""));)t[4]?r.shift():t[3]?(i=t[3].replace(l," ").trim(),r.unshift(r[0][i]=r[0][i]||{})):r[0][t[1]]=t[2].replace(l," ").trim();return r[0]})(e);u[p]=c(s?{["@keyframes "+p]:t}:t,i?"":"."+p)}let f=i&&u.g?u.g:null;return i&&(u.g=u[p]),a=u[p],f?t.data=t.data.replace(f,a):-1===t.data.indexOf(a)&&(t.data=r?a+t.data:t.data+a),p})(s.unshift?s.raw?(t=[].slice.call(arguments,1),i=r.p,s.reduce((e,r,s)=>{let a=t[s];if(a&&a.call){let e=a(i),t=e&&e.props&&e.props.className||/^go/.test(e)&&e;a=t?"."+t:e&&"object"==typeof e?e.props?"":c(e,""):!1===e?"":e}return e+r+(null==a?"":a)},"")):s.reduce((e,t)=>Object.assign(e,t&&t.call?t(r.p):t),{}):s,(e=>{if("object"==typeof window){let t=(e?e.querySelector("#_goober"):window._goober)||Object.assign(document.createElement("style"),{innerHTML:" ",id:"_goober"});return t.nonce=window.__nonce__,t.parentNode||(e||document.head).appendChild(t),t.firstChild}return e||a})(r.target),r.g,r.o,r.k)}h.bind({g:1});let p,f,m,y=h.bind({k:1});function v(e,t){let i=this||{};return function(){let r=arguments;function s(a,n){let o=Object.assign({},a),l=o.className||s.className;i.p=Object.assign({theme:f&&f()},o),i.o=/ *go\d+/.test(l),o.className=h.apply(i,r)+(l?" "+l:""),t&&(o.ref=n);let c=e;return e[0]&&(c=o.as||e,delete o.as),m&&c[0]&&m(o),p(c,o)}return t?t(s):s}}var b=(e,t)=>"function"==typeof e?e(t):e,g=(t=0,()=>(++t).toString()),w=()=>{if(void 0===i&&"u">typeof window){let e=matchMedia("(prefers-reduced-motion: reduce)");i=!e||e.matches}return i},S="default",x=(e,t)=>{let{toastLimit:i}=e.settings;switch(t.type){case 0:return{...e,toasts:[t.toast,...e.toasts].slice(0,i)};case 1:return{...e,toasts:e.toasts.map(e=>e.id===t.toast.id?{...e,...t.toast}:e)};case 2:let{toast:r}=t;return x(e,{type:+!!e.toasts.find(e=>e.id===r.id),toast:r});case 3:let{toastId:s}=t;return{...e,toasts:e.toasts.map(e=>e.id===s||void 0===s?{...e,dismissed:!0,visible:!1}:e)};case 4:return void 0===t.toastId?{...e,toasts:[]}:{...e,toasts:e.toasts.filter(e=>e.id!==t.toastId)};case 5:return{...e,pausedAt:t.time};case 6:let a=t.time-(e.pausedAt||0);return{...e,pausedAt:void 0,toasts:e.toasts.map(e=>({...e,pauseDuration:e.pauseDuration+a}))}}},C=[],k={toasts:[],pausedAt:void 0,settings:{toastLimit:20}},E={},T=(e,t=S)=>{E[t]=x(E[t]||k,e),C.forEach(([e,i])=>{e===t&&i(E[t])})},A=e=>Object.keys(E).forEach(t=>T(e,t)),O=(e=S)=>t=>{T(t,e)},j={blank:4e3,error:4e3,success:2e3,loading:1/0,custom:4e3},F=e=>(t,i)=>{let r,s=((e,t="blank",i)=>({createdAt:Date.now(),visible:!0,dismissed:!1,type:t,ariaProps:{role:"status","aria-live":"polite"},message:e,pauseDuration:0,...i,id:(null==i?void 0:i.id)||g()}))(t,e,i);return O(s.toasterId||(r=s.id,Object.keys(E).find(e=>E[e].toasts.some(e=>e.id===r))))({type:2,toast:s}),s.id},P=(e,t)=>F("blank")(e,t);P.error=F("error"),P.success=F("success"),P.loading=F("loading"),P.custom=F("custom"),P.dismiss=(e,t)=>{let i={type:3,toastId:e};t?O(t)(i):A(i)},P.dismissAll=e=>P.dismiss(void 0,e),P.remove=(e,t)=>{let i={type:4,toastId:e};t?O(t)(i):A(i)},P.removeAll=e=>P.remove(void 0,e),P.promise=(e,t,i)=>{let r=P.loading(t.loading,{...i,...null==i?void 0:i.loading});return"function"==typeof e&&(e=e()),e.then(e=>{let s=t.success?b(t.success,e):void 0;return s?P.success(s,{id:r,...i,...null==i?void 0:i.success}):P.dismiss(r),e}).catch(e=>{let s=t.error?b(t.error,e):void 0;s?P.error(s,{id:r,...i,...null==i?void 0:i.error}):P.dismiss(r)}),e};var D=1e3,M=y`
from {
  transform: scale(0) rotate(45deg);
	opacity: 0;
}
to {
 transform: scale(1) rotate(45deg);
  opacity: 1;
}`,I=y`
from {
  transform: scale(0);
  opacity: 0;
}
to {
  transform: scale(1);
  opacity: 1;
}`,U=y`
from {
  transform: scale(0) rotate(90deg);
	opacity: 0;
}
to {
  transform: scale(1) rotate(90deg);
	opacity: 1;
}`,R=v("div")`
  width: 20px;
  opacity: 0;
  height: 20px;
  border-radius: 10px;
  background: ${e=>e.primary||"#ff4b4b"};
  position: relative;
  transform: rotate(45deg);

  animation: ${M} 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
  animation-delay: 100ms;

  &:after,
  &:before {
    content: '';
    animation: ${I} 0.15s ease-out forwards;
    animation-delay: 150ms;
    position: absolute;
    border-radius: 3px;
    opacity: 0;
    background: ${e=>e.secondary||"#fff"};
    bottom: 9px;
    left: 4px;
    height: 2px;
    width: 12px;
  }

  &:before {
    animation: ${U} 0.15s ease-out forwards;
    animation-delay: 180ms;
    transform: rotate(90deg);
  }
`,L=y`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`,q=v("div")`
  width: 12px;
  height: 12px;
  box-sizing: border-box;
  border: 2px solid;
  border-radius: 100%;
  border-color: ${e=>e.secondary||"#e0e0e0"};
  border-right-color: ${e=>e.primary||"#616161"};
  animation: ${L} 1s linear infinite;
`,$=y`
from {
  transform: scale(0) rotate(45deg);
	opacity: 0;
}
to {
  transform: scale(1) rotate(45deg);
	opacity: 1;
}`,N=y`
0% {
	height: 0;
	width: 0;
	opacity: 0;
}
40% {
  height: 0;
	width: 6px;
	opacity: 1;
}
100% {
  opacity: 1;
  height: 10px;
}`,K=v("div")`
  width: 20px;
  opacity: 0;
  height: 20px;
  border-radius: 10px;
  background: ${e=>e.primary||"#61d345"};
  position: relative;
  transform: rotate(45deg);

  animation: ${$} 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
  animation-delay: 100ms;
  &:after {
    content: '';
    box-sizing: border-box;
    animation: ${N} 0.2s ease-out forwards;
    opacity: 0;
    animation-delay: 200ms;
    position: absolute;
    border-right: 2px solid;
    border-bottom: 2px solid;
    border-color: ${e=>e.secondary||"#fff"};
    bottom: 6px;
    left: 6px;
    height: 10px;
    width: 6px;
  }
`,z=v("div")`
  position: absolute;
`,H=v("div")`
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  min-width: 20px;
  min-height: 20px;
`,Q=y`
from {
  transform: scale(0.6);
  opacity: 0.4;
}
to {
  transform: scale(1);
  opacity: 1;
}`,B=v("div")`
  position: relative;
  transform: scale(0.6);
  opacity: 0.4;
  min-width: 20px;
  animation: ${Q} 0.3s 0.12s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
`,G=({toast:e})=>{let{icon:t,type:i,iconTheme:r}=e;return void 0!==t?"string"==typeof t?s.createElement(B,null,t):t:"blank"===i?null:s.createElement(H,null,s.createElement(q,{...r}),"loading"!==i&&s.createElement(z,null,"error"===i?s.createElement(R,{...r}):s.createElement(K,{...r})))},_=v("div")`
  display: flex;
  align-items: center;
  background: #fff;
  color: #363636;
  line-height: 1.3;
  will-change: transform;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.1), 0 3px 3px rgba(0, 0, 0, 0.05);
  max-width: 350px;
  pointer-events: auto;
  padding: 8px 10px;
  border-radius: 8px;
`,Z=v("div")`
  display: flex;
  justify-content: center;
  margin: 4px 10px;
  color: inherit;
  flex: 1 1 auto;
  white-space: pre-line;
`,W=s.memo(({toast:e,position:t,style:i,children:r})=>{let a=e.height?((e,t)=>{let i=e.includes("top")?1:-1,[r,s]=w()?["0%{opacity:0;} 100%{opacity:1;}","0%{opacity:1;} 100%{opacity:0;}"]:[`
0% {transform: translate3d(0,${-200*i}%,0) scale(.6); opacity:.5;}
100% {transform: translate3d(0,0,0) scale(1); opacity:1;}
`,`
0% {transform: translate3d(0,0,-1px) scale(1); opacity:1;}
100% {transform: translate3d(0,${-150*i}%,-1px) scale(.6); opacity:0;}
`];return{animation:t?`${y(r)} 0.35s cubic-bezier(.21,1.02,.73,1) forwards`:`${y(s)} 0.4s forwards cubic-bezier(.06,.71,.55,1)`}})(e.position||t||"top-center",e.visible):{opacity:0},n=s.createElement(G,{toast:e}),o=s.createElement(Z,{...e.ariaProps},b(e.message,e));return s.createElement(_,{className:e.className,style:{...a,...i,...e.style}},"function"==typeof r?r({icon:n,message:o}):s.createElement(s.Fragment,null,n,o))});r=s.createElement,c.p=void 0,p=r,f=void 0,m=void 0;var V=({id:e,className:t,style:i,onHeightUpdate:r,children:a})=>{let n=s.useCallback(t=>{if(t){let i=()=>{r(e,t.getBoundingClientRect().height)};i(),new MutationObserver(i).observe(t,{subtree:!0,childList:!0,characterData:!0})}},[e,r]);return s.createElement("div",{ref:n,className:t,style:i},a)},J=h`
  z-index: 9999;
  > * {
    pointer-events: auto;
  }
`,X=({reverseOrder:e,position:t="top-center",toastOptions:i,gutter:r,children:a,toasterId:n,containerStyle:o,containerClassName:l})=>{let{toasts:c,handlers:u}=((e,t="default")=>{let{toasts:i,pausedAt:r}=((e={},t=S)=>{let[i,r]=(0,s.useState)(E[t]||k),a=(0,s.useRef)(E[t]);(0,s.useEffect)(()=>(a.current!==E[t]&&r(E[t]),C.push([t,r]),()=>{let e=C.findIndex(([e])=>e===t);e>-1&&C.splice(e,1)}),[t]);let n=i.toasts.map(t=>{var i,r,s;return{...e,...e[t.type],...t,removeDelay:t.removeDelay||(null==(i=e[t.type])?void 0:i.removeDelay)||(null==e?void 0:e.removeDelay),duration:t.duration||(null==(r=e[t.type])?void 0:r.duration)||(null==e?void 0:e.duration)||j[t.type],style:{...e.style,...null==(s=e[t.type])?void 0:s.style,...t.style}}});return{...i,toasts:n}})(e,t),a=(0,s.useRef)(new Map).current,n=(0,s.useCallback)((e,t=D)=>{if(a.has(e))return;let i=setTimeout(()=>{a.delete(e),o({type:4,toastId:e})},t);a.set(e,i)},[]);(0,s.useEffect)(()=>{if(r)return;let e=Date.now(),s=i.map(i=>{if(i.duration===1/0)return;let r=(i.duration||0)+i.pauseDuration-(e-i.createdAt);if(r<0){i.visible&&P.dismiss(i.id);return}return setTimeout(()=>P.dismiss(i.id,t),r)});return()=>{s.forEach(e=>e&&clearTimeout(e))}},[i,r,t]);let o=(0,s.useCallback)(O(t),[t]),l=(0,s.useCallback)(()=>{o({type:5,time:Date.now()})},[o]),c=(0,s.useCallback)((e,t)=>{o({type:1,toast:{id:e,height:t}})},[o]),u=(0,s.useCallback)(()=>{r&&o({type:6,time:Date.now()})},[r,o]),d=(0,s.useCallback)((e,t)=>{let{reverseOrder:r=!1,gutter:s=8,defaultPosition:a}=t||{},n=i.filter(t=>(t.position||a)===(e.position||a)&&t.height),o=n.findIndex(t=>t.id===e.id),l=n.filter((e,t)=>t<o&&e.visible).length;return n.filter(e=>e.visible).slice(...r?[l+1]:[0,l]).reduce((e,t)=>e+(t.height||0)+s,0)},[i]);return(0,s.useEffect)(()=>{i.forEach(e=>{if(e.dismissed)n(e.id,e.removeDelay);else{let t=a.get(e.id);t&&(clearTimeout(t),a.delete(e.id))}})},[i,n]),{toasts:i,handlers:{updateHeight:c,startPause:l,endPause:u,calculateOffset:d}}})(i,n);return s.createElement("div",{"data-rht-toaster":n||"",style:{position:"fixed",zIndex:9999,top:16,left:16,right:16,bottom:16,pointerEvents:"none",...o},className:l,onMouseEnter:u.startPause,onMouseLeave:u.endPause},c.map(i=>{let n,o,l=i.position||t,c=u.calculateOffset(i,{reverseOrder:e,gutter:r,defaultPosition:t}),d=(n=l.includes("top"),o=l.includes("center")?{justifyContent:"center"}:l.includes("right")?{justifyContent:"flex-end"}:{},{left:0,right:0,display:"flex",position:"absolute",transition:w()?void 0:"all 230ms cubic-bezier(.21,1.02,.73,1)",transform:`translateY(${c*(n?1:-1)}px)`,...n?{top:0}:{bottom:0},...o});return s.createElement(V,{id:i.id,key:i.id,onHeightUpdate:u.updateHeight,className:i.visible?J:"",style:d},"custom"===i.type?b(i.message,i):a?a(i):s.createElement(W,{toast:i,position:l}))}))};e.s(["Toaster",()=>X,"default",()=>P,"toast",()=>P],5207)},20802,e=>{"use strict";let t=(0,e.i(12088).default)("x",[["path",{d:"M18 6 6 18",key:"1bl5f8"}],["path",{d:"m6 6 12 12",key:"d8bk6v"}]]);e.s(["X",()=>t],20802)},27585,25994,e=>{"use strict";e.i(98712);var t={setTimeout:(e,t)=>setTimeout(e,t),clearTimeout:e=>clearTimeout(e),setInterval:(e,t)=>setInterval(e,t),clearInterval:e=>clearInterval(e)},i=new class{#e=t;#t=!1;setTimeoutProvider(e){this.#e=e}setTimeout(e,t){return this.#e.setTimeout(e,t)}clearTimeout(e){this.#e.clearTimeout(e)}setInterval(e,t){return this.#e.setInterval(e,t)}clearInterval(e){this.#e.clearInterval(e)}};function r(e){setTimeout(e,0)}e.s(["systemSetTimeoutZero",()=>r,"timeoutManager",()=>i],25994);var s="u"<typeof window||"Deno"in globalThis;function a(){}function n(e,t){return"function"==typeof e?e(t):e}function o(e){return"number"==typeof e&&e>=0&&e!==1/0}function l(e,t){return Math.max(e+(t||0)-Date.now(),0)}function c(e,t){return"function"==typeof e?e(t):e}function u(e,t){return"function"==typeof e?e(t):e}function d(e,t){let{type:i="all",exact:r,fetchStatus:s,predicate:a,queryKey:n,stale:o}=e;if(n){if(r){if(t.queryHash!==p(n,t.options))return!1}else if(!m(t.queryKey,n))return!1}if("all"!==i){let e=t.isActive();if("active"===i&&!e||"inactive"===i&&e)return!1}return("boolean"!=typeof o||t.isStale()===o)&&(!s||s===t.state.fetchStatus)&&(!a||!!a(t))}function h(e,t){let{exact:i,status:r,predicate:s,mutationKey:a}=e;if(a){if(!t.options.mutationKey)return!1;if(i){if(f(t.options.mutationKey)!==f(a))return!1}else if(!m(t.options.mutationKey,a))return!1}return(!r||t.state.status===r)&&(!s||!!s(t))}function p(e,t){return(t?.queryKeyHashFn||f)(e)}function f(e){return JSON.stringify(e,(e,t)=>g(t)?Object.keys(t).sort().reduce((e,i)=>(e[i]=t[i],e),{}):t)}function m(e,t){return e===t||typeof e==typeof t&&!!e&&!!t&&"object"==typeof e&&"object"==typeof t&&Object.keys(t).every(i=>m(e[i],t[i]))}var y=Object.prototype.hasOwnProperty;function v(e,t){if(!t||Object.keys(e).length!==Object.keys(t).length)return!1;for(let i in e)if(e[i]!==t[i])return!1;return!0}function b(e){return Array.isArray(e)&&e.length===Object.keys(e).length}function g(e){if(!w(e))return!1;let t=e.constructor;if(void 0===t)return!0;let i=t.prototype;return!!w(i)&&!!i.hasOwnProperty("isPrototypeOf")&&Object.getPrototypeOf(e)===Object.prototype}function w(e){return"[object Object]"===Object.prototype.toString.call(e)}function S(e){return new Promise(t=>{i.setTimeout(t,e)})}function x(e,t,i){return"function"==typeof i.structuralSharing?i.structuralSharing(e,t):!1!==i.structuralSharing?function e(t,i,r=0){if(t===i)return t;if(r>500)return i;let s=b(t)&&b(i);if(!s&&!(g(t)&&g(i)))return i;let a=(s?t:Object.keys(t)).length,n=s?i:Object.keys(i),o=n.length,l=s?Array(o):{},c=0;for(let u=0;u<o;u++){let o=s?u:n[u],d=t[o],h=i[o];if(d===h){l[o]=d,(s?u<a:y.call(t,o))&&c++;continue}if(null===d||null===h||"object"!=typeof d||"object"!=typeof h){l[o]=h;continue}let p=e(d,h,r+1);l[o]=p,p===d&&c++}return a===o&&c===a?t:l}(e,t):t}function C(e,t,i=0){let r=[...e,t];return i&&r.length>i?r.slice(1):r}function k(e,t,i=0){let r=[t,...e];return i&&r.length>i?r.slice(0,-1):r}var E=Symbol();function T(e,t){return!e.queryFn&&t?.initialPromise?()=>t.initialPromise:e.queryFn&&e.queryFn!==E?e.queryFn:()=>Promise.reject(Error(`Missing queryFn: '${e.queryHash}'`))}function A(e,t){return"function"==typeof e?e(...t):!!e}function O(e,t,i){let r,s=!1;return Object.defineProperty(e,"signal",{enumerable:!0,get:()=>(r??=t(),s||(s=!0,r.aborted?i():r.addEventListener("abort",i,{once:!0})),r)}),e}e.s(["addConsumeAwareSignal",()=>O,"addToEnd",()=>C,"addToStart",()=>k,"ensureQueryFn",()=>T,"functionalUpdate",()=>n,"hashKey",()=>f,"hashQueryKeyByOptions",()=>p,"isServer",()=>s,"isValidTimeout",()=>o,"matchMutation",()=>h,"matchQuery",()=>d,"noop",()=>a,"partialMatchKey",()=>m,"replaceData",()=>x,"resolveEnabled",()=>u,"resolveStaleTime",()=>c,"shallowEqualObjects",()=>v,"shouldThrowError",()=>A,"skipToken",()=>E,"sleep",()=>S,"timeUntilStale",()=>l],27585)},73759,e=>{"use strict";let t,i,r,s,a,n;var o=e.i(25994).systemSetTimeoutZero,l=(t=[],i=0,r=e=>{e()},s=e=>{e()},a=o,{batch:e=>{let n;i++;try{n=e()}finally{let e;--i||(e=t,t=[],e.length&&a(()=>{s(()=>{e.forEach(e=>{r(e)})})}))}return n},batchCalls:e=>(...t)=>{n(()=>{e(...t)})},schedule:n=e=>{i?t.push(e):a(()=>{r(e)})},setNotifyFunction:e=>{r=e},setBatchNotifyFunction:e=>{s=e},setScheduler:e=>{a=e}});e.s(["notifyManager",()=>l])},57785,e=>{"use strict";var t=class{constructor(){this.listeners=new Set,this.subscribe=this.subscribe.bind(this)}subscribe(e){return this.listeners.add(e),this.onSubscribe(),()=>{this.listeners.delete(e),this.onUnsubscribe()}}hasListeners(){return this.listeners.size>0}onSubscribe(){}onUnsubscribe(){}};e.s(["Subscribable",()=>t])},29853,e=>{"use strict";var t=e.i(57785),i=e.i(27585),r=new class extends t.Subscribable{#i;#r;#s;constructor(){super(),this.#s=e=>{if(!i.isServer&&window.addEventListener){let t=()=>e();return window.addEventListener("visibilitychange",t,!1),()=>{window.removeEventListener("visibilitychange",t)}}}}onSubscribe(){this.#r||this.setEventListener(this.#s)}onUnsubscribe(){this.hasListeners()||(this.#r?.(),this.#r=void 0)}setEventListener(e){this.#s=e,this.#r?.(),this.#r=e(e=>{"boolean"==typeof e?this.setFocused(e):this.onFocus()})}setFocused(e){this.#i!==e&&(this.#i=e,this.onFocus())}onFocus(){let e=this.isFocused();this.listeners.forEach(t=>{t(e)})}isFocused(){return"boolean"==typeof this.#i?this.#i:globalThis.document?.visibilityState!=="hidden"}};e.s(["focusManager",()=>r])},10853,6897,67305,63456,8573,25323,e=>{"use strict";e.i(98712);var t=e.i(27585),i=e.i(73759),r=e.i(29853),s=e.i(57785),a=new class extends s.Subscribable{#a=!0;#r;#s;constructor(){super(),this.#s=e=>{if(!t.isServer&&window.addEventListener){let t=()=>e(!0),i=()=>e(!1);return window.addEventListener("online",t,!1),window.addEventListener("offline",i,!1),()=>{window.removeEventListener("online",t),window.removeEventListener("offline",i)}}}}onSubscribe(){this.#r||this.setEventListener(this.#s)}onUnsubscribe(){this.hasListeners()||(this.#r?.(),this.#r=void 0)}setEventListener(e){this.#s=e,this.#r?.(),this.#r=e(this.setOnline.bind(this))}setOnline(e){this.#a!==e&&(this.#a=e,this.listeners.forEach(t=>{t(e)}))}isOnline(){return this.#a}};function n(){let e,t,i=new Promise((i,r)=>{e=i,t=r});function r(e){Object.assign(i,e),delete i.resolve,delete i.reject}return i.status="pending",i.catch(()=>{}),i.resolve=t=>{r({status:"fulfilled",value:t}),e(t)},i.reject=e=>{r({status:"rejected",reason:e}),t(e)},i}function o(e){return Math.min(1e3*2**e,3e4)}function l(e){return(e??"online")!=="online"||a.isOnline()}e.s(["onlineManager",()=>a],6897),e.s(["pendingThenable",()=>n],67305);var c=class extends Error{constructor(e){super("CancelledError"),this.revert=e?.revert,this.silent=e?.silent}};function u(e){let i,s=!1,u=0,d=n(),h=()=>r.focusManager.isFocused()&&("always"===e.networkMode||a.isOnline())&&e.canRun(),p=()=>l(e.networkMode)&&e.canRun(),f=e=>{"pending"===d.status&&(i?.(),d.resolve(e))},m=e=>{"pending"===d.status&&(i?.(),d.reject(e))},y=()=>new Promise(t=>{i=e=>{("pending"!==d.status||h())&&t(e)},e.onPause?.()}).then(()=>{i=void 0,"pending"===d.status&&e.onContinue?.()}),v=()=>{let i;if("pending"!==d.status)return;let r=0===u?e.initialPromise:void 0;try{i=r??e.fn()}catch(e){i=Promise.reject(e)}Promise.resolve(i).then(f).catch(i=>{if("pending"!==d.status)return;let r=e.retry??3*!t.isServer,a=e.retryDelay??o,n="function"==typeof a?a(u,i):a,l=!0===r||"number"==typeof r&&u<r||"function"==typeof r&&r(u,i);s||!l?m(i):(u++,e.onFail?.(u,i),(0,t.sleep)(n).then(()=>h()?void 0:y()).then(()=>{s?m(i):v()}))})};return{promise:d,status:()=>d.status,cancel:t=>{if("pending"===d.status){let i=new c(t);m(i),e.onCancel?.(i)}},continue:()=>(i?.(),d),cancelRetry:()=>{s=!0},continueRetry:()=>{s=!1},canStart:p,start:()=>(p()?v():y().then(v),d)}}e.s(["CancelledError",()=>c,"canFetch",()=>l,"createRetryer",()=>u],63456);var d=e.i(25994),h=class{#n;destroy(){this.clearGcTimeout()}scheduleGc(){this.clearGcTimeout(),(0,t.isValidTimeout)(this.gcTime)&&(this.#n=d.timeoutManager.setTimeout(()=>{this.optionalRemove()},this.gcTime))}updateGcTime(e){this.gcTime=Math.max(this.gcTime||0,e??(t.isServer?1/0:3e5))}clearGcTimeout(){this.#n&&(d.timeoutManager.clearTimeout(this.#n),this.#n=void 0)}};e.s(["Removable",()=>h],8573);var p=class extends h{#o;#l;#c;#u;#d;#h;#p;constructor(e){super(),this.#p=!1,this.#h=e.defaultOptions,this.setOptions(e.options),this.observers=[],this.#u=e.client,this.#c=this.#u.getQueryCache(),this.queryKey=e.queryKey,this.queryHash=e.queryHash,this.#o=y(this.options),this.state=e.state??this.#o,this.scheduleGc()}get meta(){return this.options.meta}get promise(){return this.#d?.promise}setOptions(e){if(this.options={...this.#h,...e},this.updateGcTime(this.options.gcTime),this.state&&void 0===this.state.data){let e=y(this.options);void 0!==e.data&&(this.setState(m(e.data,e.dataUpdatedAt)),this.#o=e)}}optionalRemove(){this.observers.length||"idle"!==this.state.fetchStatus||this.#c.remove(this)}setData(e,i){let r=(0,t.replaceData)(this.state.data,e,this.options);return this.#f({data:r,type:"success",dataUpdatedAt:i?.updatedAt,manual:i?.manual}),r}setState(e,t){this.#f({type:"setState",state:e,setStateOptions:t})}cancel(e){let i=this.#d?.promise;return this.#d?.cancel(e),i?i.then(t.noop).catch(t.noop):Promise.resolve()}destroy(){super.destroy(),this.cancel({silent:!0})}reset(){this.destroy(),this.setState(this.#o)}isActive(){return this.observers.some(e=>!1!==(0,t.resolveEnabled)(e.options.enabled,this))}isDisabled(){return this.getObserversCount()>0?!this.isActive():this.options.queryFn===t.skipToken||this.state.dataUpdateCount+this.state.errorUpdateCount===0}isStatic(){return this.getObserversCount()>0&&this.observers.some(e=>"static"===(0,t.resolveStaleTime)(e.options.staleTime,this))}isStale(){return this.getObserversCount()>0?this.observers.some(e=>e.getCurrentResult().isStale):void 0===this.state.data||this.state.isInvalidated}isStaleByTime(e=0){return void 0===this.state.data||"static"!==e&&(!!this.state.isInvalidated||!(0,t.timeUntilStale)(this.state.dataUpdatedAt,e))}onFocus(){let e=this.observers.find(e=>e.shouldFetchOnWindowFocus());e?.refetch({cancelRefetch:!1}),this.#d?.continue()}onOnline(){let e=this.observers.find(e=>e.shouldFetchOnReconnect());e?.refetch({cancelRefetch:!1}),this.#d?.continue()}addObserver(e){this.observers.includes(e)||(this.observers.push(e),this.clearGcTimeout(),this.#c.notify({type:"observerAdded",query:this,observer:e}))}removeObserver(e){this.observers.includes(e)&&(this.observers=this.observers.filter(t=>t!==e),this.observers.length||(this.#d&&(this.#p?this.#d.cancel({revert:!0}):this.#d.cancelRetry()),this.scheduleGc()),this.#c.notify({type:"observerRemoved",query:this,observer:e}))}getObserversCount(){return this.observers.length}invalidate(){this.state.isInvalidated||this.#f({type:"invalidate"})}async fetch(e,i){let r;if("idle"!==this.state.fetchStatus&&this.#d?.status()!=="rejected"){if(void 0!==this.state.data&&i?.cancelRefetch)this.cancel({silent:!0});else if(this.#d)return this.#d.continueRetry(),this.#d.promise}if(e&&this.setOptions(e),!this.options.queryFn){let e=this.observers.find(e=>e.options.queryFn);e&&this.setOptions(e.options)}let s=new AbortController,a=e=>{Object.defineProperty(e,"signal",{enumerable:!0,get:()=>(this.#p=!0,s.signal)})},n=()=>{let e,r=(0,t.ensureQueryFn)(this.options,i),s=(a(e={client:this.#u,queryKey:this.queryKey,meta:this.meta}),e);return(this.#p=!1,this.options.persister)?this.options.persister(r,s,this):r(s)},o=(a(r={fetchOptions:i,options:this.options,queryKey:this.queryKey,client:this.#u,state:this.state,fetchFn:n}),r);this.options.behavior?.onFetch(o,this),this.#l=this.state,("idle"===this.state.fetchStatus||this.state.fetchMeta!==o.fetchOptions?.meta)&&this.#f({type:"fetch",meta:o.fetchOptions?.meta}),this.#d=u({initialPromise:i?.initialPromise,fn:o.fetchFn,onCancel:e=>{e instanceof c&&e.revert&&this.setState({...this.#l,fetchStatus:"idle"}),s.abort()},onFail:(e,t)=>{this.#f({type:"failed",failureCount:e,error:t})},onPause:()=>{this.#f({type:"pause"})},onContinue:()=>{this.#f({type:"continue"})},retry:o.options.retry,retryDelay:o.options.retryDelay,networkMode:o.options.networkMode,canRun:()=>!0});try{let e=await this.#d.start();if(void 0===e)throw Error(`${this.queryHash} data is undefined`);return this.setData(e),this.#c.config.onSuccess?.(e,this),this.#c.config.onSettled?.(e,this.state.error,this),e}catch(e){if(e instanceof c){if(e.silent)return this.#d.promise;else if(e.revert){if(void 0===this.state.data)throw e;return this.state.data}}throw this.#f({type:"error",error:e}),this.#c.config.onError?.(e,this),this.#c.config.onSettled?.(this.state.data,e,this),e}finally{this.scheduleGc()}}#f(e){let t=t=>{switch(e.type){case"failed":return{...t,fetchFailureCount:e.failureCount,fetchFailureReason:e.error};case"pause":return{...t,fetchStatus:"paused"};case"continue":return{...t,fetchStatus:"fetching"};case"fetch":return{...t,...f(t.data,this.options),fetchMeta:e.meta??null};case"success":let i={...t,...m(e.data,e.dataUpdatedAt),dataUpdateCount:t.dataUpdateCount+1,...!e.manual&&{fetchStatus:"idle",fetchFailureCount:0,fetchFailureReason:null}};return this.#l=e.manual?i:void 0,i;case"error":let r=e.error;return{...t,error:r,errorUpdateCount:t.errorUpdateCount+1,errorUpdatedAt:Date.now(),fetchFailureCount:t.fetchFailureCount+1,fetchFailureReason:r,fetchStatus:"idle",status:"error",isInvalidated:!0};case"invalidate":return{...t,isInvalidated:!0};case"setState":return{...t,...e.state}}};this.state=t(this.state),i.notifyManager.batch(()=>{this.observers.forEach(e=>{e.onQueryUpdate()}),this.#c.notify({query:this,type:"updated",action:e})})}};function f(e,t){return{fetchFailureCount:0,fetchFailureReason:null,fetchStatus:l(t.networkMode)?"fetching":"paused",...void 0===e&&{error:null,status:"pending"}}}function m(e,t){return{data:e,dataUpdatedAt:t??Date.now(),error:null,isInvalidated:!1,status:"success"}}function y(e){let t="function"==typeof e.initialData?e.initialData():e.initialData,i=void 0!==t,r=i?"function"==typeof e.initialDataUpdatedAt?e.initialDataUpdatedAt():e.initialDataUpdatedAt:0;return{data:t,dataUpdateCount:0,dataUpdatedAt:i?r??Date.now():0,error:null,errorUpdateCount:0,errorUpdatedAt:0,fetchFailureCount:0,fetchFailureReason:null,fetchMeta:null,isInvalidated:!1,status:i?"success":"pending",fetchStatus:"idle"}}e.s(["Query",()=>p,"fetchState",()=>f],10853);var v=e.i(94579),b=e.i(86322),g=v.createContext(void 0),w=e=>{let t=v.useContext(g);if(e)return e;if(!t)throw Error("No QueryClient set, use QueryClientProvider to set one");return t},S=({client:e,children:t})=>(v.useEffect(()=>(e.mount(),()=>{e.unmount()}),[e]),(0,b.jsx)(g.Provider,{value:e,children:t}));e.s(["QueryClientProvider",()=>S,"useQueryClient",()=>w],25323)}]);