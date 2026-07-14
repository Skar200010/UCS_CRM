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

    const VERIFY_TOKEN = Deno.env.get("WHATSAPP_VERIFY_TOKEN") || "ucscompany123";

    if (req.method === "GET") {
      if (mode === "subscribe" && token === VERIFY_TOKEN) {
        console.log("Webhook verified");
        return new Response(challenge, {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "text/plain" },
        });
      }
      return new Response("Forbidden", { status: 403, headers: corsHeaders });
    }

    if (req.method === "POST") {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const body = await req.json();
      console.log("Webhook received:", JSON.stringify(body, null, 2));

      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      const phoneNumberId = value?.metadata?.phone_number_id;

      let accountProject = "unknown";
      if (phoneNumberId) {
        const { data: account } = await supabase
          .from("whatsapp_accounts")
          .select("project")
          .eq("phone_number_id", phoneNumberId)
          .eq("is_active", true)
          .maybeSingle();
        if (account?.project) {
          accountProject = account.project;
        }
      }

      await supabase.from("whatsapp_webhook_logs").insert({
        direction: "inbound",
        event_type: changes?.field || "unknown",
        payload: body,
        processed: false,
        account_project: accountProject,
      });

      if (changes?.field === "messages" && value?.messages) {
        for (const message of value.messages) {
          const from = message.from;
          let bodyText = message.text?.body || null;

          if (message.type === "image") {
            bodyText = message.image?.caption || "[Image]";
          } else if (message.type === "video") {
            bodyText = message.video?.caption || "[Video]";
          } else if (message.type === "audio") {
            bodyText = "[Audio]";
          } else if (message.type === "document") {
            bodyText = message.document?.caption || "[Document]";
          } else if (message.type === "sticker") {
            bodyText = "[Sticker]";
          }

          let { data: contact } = await supabase
            .from("contacts")
            .select("*")
            .eq("phone_normalized", from)
            .maybeSingle();

          if (!contact) {
            const { data: newContact, error: contactErr } = await supabase
              .from("contacts")
              .insert({
                phone: from,
                phone_normalized: from,
                wa_profile_name: value.contacts?.[0]?.profile?.name,
                source: "whatsapp",
                project: accountProject !== "unknown" ? accountProject : null,
              })
              .select()
              .single();

            if (contactErr) throw contactErr;
            contact = newContact;
          }

          let { data: conversation } = await supabase
            .from("conversations")
            .select("*")
            .eq("contact_id", contact.id)
            .eq("status", "open")
            .maybeSingle();

          if (!conversation) {
            const { data: newConversation, error: convErr } = await supabase
              .from("conversations")
              .insert({
                contact_id: contact.id,
                phone_number_id: phoneNumberId || null,
                status: "open",
                last_message_at: new Date().toISOString(),
                last_inbound_at: new Date().toISOString(),
                project: accountProject !== "unknown" ? accountProject : null,
              })
              .select()
              .single();

            if (convErr) throw convErr;
            conversation = newConversation;
          }

          const { error: msgError } = await supabase.from("messages").insert({
            conversation_id: conversation.id,
            contact_id: contact.id,
            direction: "inbound",
            message_type: message.type,
            body_text: bodyText,
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

          const runAutomationUrl = `${supabaseUrl}/functions/v1/run-automation`;
          fetch(runAutomationUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contact_id: contact.id,
              conversation_id: conversation.id,
              trigger_type: "inbound_message",
              project: accountProject !== "unknown" ? accountProject : null,
              message: {
                id: message.id,
                from: message.from,
                text: bodyText,
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
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
