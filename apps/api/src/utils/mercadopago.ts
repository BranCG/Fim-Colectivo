import { MercadoPagoConfig, PreApproval } from 'mercadopago';
import dotenv from 'dotenv';
dotenv.config();

// Inicializa el cliente con el token de acceso
const client = new MercadoPagoConfig({ 
  accessToken: process.env.MP_ACCESS_TOKEN || '', 
  options: { timeout: 5000 } 
});

export const preapproval = new PreApproval(client);
