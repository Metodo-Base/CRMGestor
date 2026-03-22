import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

let adminDb;

try {
  if (getApps().length === 0) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

    // Corrige quebras de linha na chave privada
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }

    const app = initializeApp({
      credential: cert(serviceAccount),
    });

    console.log("🔥 Firebase inicializado com sucesso");

    // ID do banco de dados específico do AI Studio
    adminDb = getFirestore(app, 'ai-studio-3b4f18ff-9f70-4b98-8da0-9aa53728f028');
  } else {
    adminDb = getFirestore(getApps()[0], 'ai-studio-3b4f18ff-9f70-4b98-8da0-9aa53728f028');
  }
} catch (error) {
  console.error("❌ ERRO AO INICIALIZAR FIREBASE:", error);
  // Não lançar erro aqui para evitar crashar o servidor se o Firebase falhar, 
  // mas o adminDb ficará undefined e as funções que o usam tratarão isso.
}

export { adminDb };
