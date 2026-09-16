export const db={};
export const auth={currentUser:{uid:'me'}};
export const profiles={me:'',a:'https://qr.paypay.ne.jp/p/sample-a',b:''};
import {reactive} from 'vue';
export const testState=reactive({fail:false,delay:0,openedUrl:''});
export const doc=(_db,collection,uid)=>({collection,uid});
export const getDoc=async ref=>{
 const link=profiles[ref.uid]; const fail=testState.fail; const delay=ref.uid==='me'?0:testState.delay;
 await new Promise(r=>setTimeout(r,delay));
 if(fail&&ref.uid!=='me') throw new Error('検証用の通信失敗');
 return {exists:()=>true,data:()=>({paypayLink:link})};
};
export const updateDoc=async(ref,data)=>{await new Promise(r=>setTimeout(r,1200));profiles[ref.uid]=data.paypayLink;};
export const onAuthStateChanged=(_auth,callback)=>{callback(auth.currentUser);return()=>{};};
