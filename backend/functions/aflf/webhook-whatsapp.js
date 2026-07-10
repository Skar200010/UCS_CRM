import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: account } = await supabase
      .from("whatsapp_accounts")
      .select("access_token")
      .eq("project", "aflf")
      .eq("is_active", true)
      .single();

    if (!account) {
      console.error("Ashray WhatsApp account not found in DB");
      return new Response(JSON.stringify({ error: "Account not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const VERIFY_TOKEN = Deno.env.get("WHATSAPP_VERIFY_TOKEN_AFLF") || "ucscompany123";
    const WHATSAPP_ACCESS_TOKEN = account.access_token;

    if (req.method === "GET") {
      if (mode === "subscribe" && token === VERIFY_TOKEN) {
        console.log("Ashray webhook verified");
        return new Response(challenge, {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "text/plain" },
        });
      }
      return new Response("Forbidden", { status: 403, headers: corsHeaders });
    }

    if (req.method === "POST") {
      const body = await req.json();
      console.log("Ashray webhook received:", JSON.stringify(body, null, 2));

      await supabase.from("whatsapp_webhook_logs").insert({
        direction: "inbound",
        event_type: body.entry?.[0]?.changes?.[0]?.field || "unknown",
        payload: body,
        processed: false,
        account_project: "aflf",
      });

      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;

      if (changes?.field === "messages" && value?.messages) {
        for (const message of value.messages) {
          const from = message.from;
          const phoneNumberId = value.metadata?.phone_number_id;

          let { data: contact } = await supabase
            .from("contacts")
            .select("*")
            .eq("phone_normalized", from)
            .single();

          if (!contact) {
            const { data: newContact, error } = await supabase
              .from("contacts")
              .insert({
                phone: from,
                phone_normalized: from,
                wa_profile_name: value.contacts?.[0]?.profile?.name,
                source: "whatsapp",
                project: "aflf",
              })
              .select()
              .single();

            if (error) throw error;
            contact = newContact;
          }

          let localPhoneNumber: { id: string } | null = null;
          if (phoneNumberId) {
            const { data: pn } = await supabase
              .from("whatsapp_phone_numbers")
              .select("id")
              .eq("phone_number_id", phoneNumberId)
              .maybeSingle();
            localPhoneNumber = pn;
          }

          let { data: conversation } = await supabase
            .from("conversations")
            .select("*")
            .eq("contact_id", contact.id)
            .eq("status", "open")
            .single();

          if (!conversation) {
            const { data: newConversation, error } = await supabase
              .from("conversations")
              .insert({
                tenant_id: contact.tenant_id,
                contact_id: contact.id,
                phone_number_id: localPhoneNumber?.id || null,
                status: "open",
                last_message_at: new Date().toISOString(),
                last_inbound_at: new Date().toISOString(),
                project: "aflf",
              })
              .select()
              .single();

            if (error) throw error;
            conversation = newConversation;
          }

          const { error: msgError } = await supabase.from("messages").insert({
            tenant_id: contact.tenant_id,
            conversation_id: conversation.id,
            contact_id: contact.id,
            direction: "inbound",
            message_type: message.type,
            body_text: message.text?.body,
            wa_message_id: message.id,
            status: "delivered",
            message_category: "service",
          });

          if (msgError) throw msgError;

          await supabase
            .from("conversations")
            .update({
              last_message_at: new Date().toISOString(),
              last_inbound_at: new Date().toISOString(),
            })
            .eq("id", conversation.id);

          const supabaseUrl = Deno.env.get("SUPABASE_URL")!.replace(/\/$/, "");
          const runAutomationUrl = `${supabaseUrl}/functions/v1/run-automation`;
          fetch(runAutomationUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tenant_id: contact.tenant_id,
              contact_id: contact.id,
              conversation_id: conversation.id,
              trigger_type: "inbound_message",
              message: {
                id: message.id,
                from: message.from,
                text: message.text?.body,
                type: message.type,
              },
            }),
          }).catch((err) => console.error("Failed to trigger automations:", err));
        }
      }

      if (changes?.field === "message_status" && value?.statuses) {
        for (const status of value.statuses) {
          await supabase
            .from("messages")
            .update({
              status: status.status,
              status_updated_at: new Date().toISOString(),
            })
            .eq("wa_message_id", status.id);
        }
      }

      await supabase
        .from("whatsapp_webhook_logs")
        .update({ processed: true, processed_at: new Date().toISOString() })
        .eq("processed", false)
        .order("created_at", { ascending: false })
        .limit(1);

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  } catch (error) {
    console.error("Ashray webhook error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
