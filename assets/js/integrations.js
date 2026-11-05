// Pontos de extensão. Nenhuma destas capacidades está conectada nesta versão.
export const capabilities = Object.freeze({agents:false,messaging:false,analytics:false,subscriptions:false,fullBirthChart:false});
export const agents = {async generate(){throw new Error('A geração por IA ainda não está conectada.');}};
export const messaging = {async send(){throw new Error('O canal de mensagens ainda não está conectado.');}};
export const analytics = {track(){/* Desativado por padrão; não coletar dados sem decisão e consentimento. */}};
export const astrology = {async birthChart(){throw new Error('Mapa astral completo não está disponível.');}};
