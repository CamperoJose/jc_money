import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ejecutarCorreos } from "@/lib/jobs/correos";
import { getUsuariosJob, ejecutarPorUsuario } from "@/lib/jobs/por-usuario";
export const dynamic = "force-dynamic"; export const maxDuration = 60;
function autorizado(request: Request): boolean { const esperado=process.env.API_BEARER_TOKEN; if(!esperado)return false; const auth=request.headers.get("authorization"); if(auth===`Bearer ${esperado}`)return true; return new URL(request.url).searchParams.get("token")===esperado; }
async function manejar(request: Request){
 if(!autorizado(request))return NextResponse.json({error:"No autorizado"},{status:401}); const url=new URL(request.url); const targetDate=url.searchParams.get("date")??undefined;
 if(targetDate&&!/^\d{4}-\d{2}-\d{2}$/.test(targetDate))return NextResponse.json({error:"Parámetro date inválido (YYYY-MM-DD)."},{status:400});
 try{const admin=createAdminClient();const usuarios=await getUsuariosJob(admin);if(!usuarios.length)return NextResponse.json({ok:false,reason:"No hay usuarios en la app."},{status:500});const resultados=await ejecutarPorUsuario(admin,usuarios,()=>ejecutarCorreos(admin,{targetDate}));return NextResponse.json({ok:resultados.every(r=>r.ok),usuarios:resultados.length,resultados});}catch(e){return NextResponse.json({ok:false,error:e instanceof Error?e.message:String(e)},{status:500});}
}
export async function POST(request:Request){return manejar(request);} export async function GET(request:Request){return manejar(request);}
