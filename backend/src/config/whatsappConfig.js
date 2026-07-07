import dotenv from 'dotenv';
dotenv.config();

const whatsappConfig = {
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
  apiVersion: process.env.WHATSAPP_API_VERSION || 'v23.0',
  receiptTemplate: process.env.WHATSAPP_RECEIPT_TEMPLATE || 'donation_receipt',
  enabled: !!(process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN),
  supabaseFunctionUrl: process.env.WHATSAPP_SUPABASE_FUNCTION_URL || 'https://tvijqgsfdsaoqroebkvz.supabase.co/functions/v1/send-message',
  supabaseApiKey: process.env.WHATSAPP_SUPABASE_API_KEY || '494bfff5cda25cb18eb7cd03b24c76b987268d9d6be92e93c326c47c14b2c6c6',
};

export default whatsappConfig;
