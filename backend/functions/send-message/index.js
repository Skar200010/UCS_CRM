import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const WHATSAPP_API = "https://graph.facebook.com/v23.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function resolveAccount(supabase, conversationId, project, phoneNumberIdFromConv) {
  if (phoneNumberIdFromConv) {
    const { data: pn } = await supabase
      .from("whatsapp_accounts")
      .select("*")
      .eq("phone_number_id", phoneNumberIdFromConv)
      .eq("is_active", true)
      .maybeSingle();
    if (pn) return pn;
  }

  if (project) {
    const { data: acc } = await supabase
      .from("whatsapp_accounts")
      .select("*")
      .eq("project", project)
      .eq("is_active", true)
      .maybeSingle();
    if (acc) return acc;
  }

  const { data: defaultAcc } = await supabase
    .from("whatsapp_accounts")
    .select("*")
    .eq("is_default", true)
    .eq("is_active", true)
    .maybeSingle();
  if (defaultAcc) return defaultAcc;

  const { data: anyAcc } = await supabase
    .from("whatsapp_accounts")
    .select("*")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  return anyAcc;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { conversationId, phone, messageText, project, phoneNumberId: customPhoneNumberId, mediaUrl, mediaMimeType } = await req.json();

    if ((!conversationId && !phone) || (!messageText && !mediaUrl)) {
      return new Response(
        JSON.stringify({ error: "Provide conversationId or phone, and messageText or mediaUrl" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let conversation = null;
    let contact = null;

    if (conversationId) {
      const { data: conv, error: convError } = await supabase
        .from("conversations")
        .select("*, contact:contacts(*)")
        .eq("id", conversationId)
        .single();

      if (convError || !conv) {
        return new Response(
          JSON.stringify({ error: "Conversation not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      conversation = conv;
      contact = conv.contact;
    } else {
      const phoneNormalized = phone.replace(/[^0-9]/g, "");
      const { data: existingContact } = await supabase
        .from("contacts")
        .select("*")
        .eq("phone_normalized", phoneNormalized)
        .maybeSingle();

      if (existingContact) {
        contact = existingContact;
      } else {
        const { data: newContact, error: createError } = await supabase
          .from("contacts")
          .insert({ phone, phone_normalized: phoneNormalized, source: "api", project: project || null })
          .select()
          .single();
        if (createError) throw createError;
        contact = newContact;
      }

      const { data: existingConv } = await supabase
        .from("conversations")
        .select("*, contact:contacts(*)")
        .eq("contact_id", contact.id)
        .eq("status", "open")
        .maybeSingle();

      if (existingConv) {
        conversation = existingConv;
      } else {
        const { data: newConv, error: convError } = await supabase
          .from("conversations")
          .insert({
            contact_id: contact.id,
            phone_number_id: null,
            status: "open",
            last_message_at: new Date().toISOString(),
            project: project || null,
          })
          .select("*, contact:contacts(*)")
          .single();
        if (convError) throw convError;
        conversation = newConv;
      }
    }

    const convId = conversation.id;

    let messageType = "text";
    if (mediaUrl) {
      if (mediaMimeType?.startsWith("image/")) messageType = "image";
      else if (mediaMimeType?.startsWith("video/")) messageType = "video";
      else if (mediaMimeType?.startsWith("audio/")) messageType = "audio";
      else messageType = "document";
    }

    const { data: message, error: msgError } = await supabase
      .from("messages")
      .insert({
        conversation_id: convId,
        contact_id: conversation.contact_id,
        direction: "outbound",
        message_type: messageType,
        body_text: messageText || null,
        status: "queued",
        message_category: "service",
      })
      .select()
      .single();

    if (msgError) throw msgError;

    const phoneNumberIdFromConv = conversation.phone_number_id || customPhoneNumberId;
    const account = await resolveAccount(supabase, conversationId, project, phoneNumberIdFromConv);

    if (!account) {
      await supabase.from("messages").update({ status: "failed", failure_reason: "No WhatsApp account found" }).eq("id", message.id);
      return new Response(
        JSON.stringify({ error: "No active WhatsApp account found. Add one in Phone Numbers settings." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const phoneNumberId = account.phone_number_id;
    const accessToken = account.access_token;
    const recipientPhone = contact?.phone_normalized;

    try {
      let payload = {
        messaging_product: "whatsapp",
        to: recipientPhone,
      };

      if (mediaUrl && mediaMimeType) {
        payload.type = messageType;
        const mediaObject = { link: mediaUrl };
        if (messageText) mediaObject.caption = messageText;
        if (messageType === "image") payload.image = mediaObject;
        else if (messageType === "video") payload.video = mediaObject;
        else if (messageType === "audio") payload.audio = { link: mediaUrl };
        else payload.document = mediaObject;
      } else {
        payload.type = "text";
        payload.text = { body: messageText };
      }

      const response = await fetch(
        `https://graph.facebook.com/v23.0/${phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const result = await response.json();

      if (response.ok && result.messages?.[0]?.id) {
        await supabase
          .from("messages")
          .update({
            wa_message_id: result.messages[0].id,
            status: "sent",
            status_updated_at: new Date().toISOString(),
          })
          .eq("id", message.id);
      } else {
        const errMsg = result.error?.message || "Unknown error";
        await supabase
          .from("messages")
          .update({
            status: "failed",
            failure_reason: errMsg,
            status_updated_at: new Date().toISOString(),
          })
          .eq("id", message.id);
      }
    } catch (apiError) {
      console.error("WhatsApp API error:", apiError);
      await supabase
        .from("messages")
        .update({
          status: "failed",
          failure_reason: apiError.message || "Failed to send to WhatsApp API",
          status_updated_at: new Date().toISOString(),
        })
        .eq("id", message.id);
    }

    await supabase
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", convId);

    return new Response(JSON.stringify({ success: true, message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Send message error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
