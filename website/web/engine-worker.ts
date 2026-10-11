// Runs the Rust engine's model build off the main thread. The studio posts its design; the worker
// answers with the model JSON (or an error, and the studio then builds it itself).
let engine:Promise<any>|null=null;
self.onmessage=async(event:MessageEvent)=>{
 const {seq,config,module,wasm}=event.data as {seq:number,config:string,module:string,wasm:string};
 try{
  engine??=import(/* @vite-ignore */module).then(async app=>{await app.default({module_or_path:wasm});return app;});
  const app=await engine;(self as any).postMessage({seq,model:app.calculate(config)});
 }catch(error){(self as any).postMessage({seq,error:String(error)});}
};
