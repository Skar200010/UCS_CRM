import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function resolveAccount(supabase, project, phoneNumberIdFromConv) {
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

function getContextValue(path, ctx, contact) {
  if (path.startsWith("message.")) {
    const key = path.slice(8);
    return ctx.message?.[key];
  }
  if (path.startsWith("contact.")) {
    const key = path.slice(8);
    return contact[key];
  }
  if (path === "conversation_id") return ctx.conversation_id;
  return undefined;
}

function evaluateCondition(variable, operator, value) {
  const strVar = String(variable ?? "");
  switch (operator) {
    case "equals": return strVar === value;
    case "contains": return strVar.includes(value);
    case "greater_than": {
      const numVar = Number(variable);
      const numVal = Number(value);
      if (isNaN(numVar) || isNaN(numVal)) return false;
      return numVar > numVal;
    }
    case "less_than": {
      const numVar = Number(variable);
      const numVal = Number(value);
      if (isNaN(numVar) || isNaN(numVal)) return false;
      return numVar < numVal;
    }
    default: return false;
  }
}

async function sendWhatsAppMessage(supabase, tenantId, conversationId, contactId, recipientPhone, messageText, phoneNumberId, accessToken) {
  const { data: msgRecord, error: insertError } = await supabase
    .from("messages")
    .insert({
      tenant_id: tenantId,
      conversation_id: conversationId,
      contact_id: contactId,
      direction: "outbound",
      message_type: "text",
      body_text: messageText,
      status: "queued",
      is_automated: true,
      message_category: "service",
    })
    .select()
    .single();

  if (insertError) return { success: false, error: insertError.message };

  if (!accessToken || !phoneNumberId) {
    await supabase.from("messages").update({ status: "failed", failure_reason: "WhatsApp account not configured" }).eq("id", msgRecord.id);
    return { success: false, error: "WhatsApp account not configured" };
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v23.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: recipientPhone,
          type: "text",
          text: { body: messageText },
        }),
      }
    );

    const result = await response.json();
    if (response.ok && result.messages?.[0]?.id) {
      await supabase
        .from("messages")
        .update({ wa_message_id: result.messages[0].id, status: "sent", status_updated_at: new Date().toISOString() })
        .eq("id", msgRecord.id);
      return { success: true };
    } else {
      const errMsg = result.error?.message || "Unknown error";
      await supabase
        .from("messages")
        .update({ status: "failed", failure_reason: errMsg, status_updated_at: new Date().toISOString() })
        .eq("id", msgRecord.id);
      return { success: false, error: errMsg };
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Failed to send to WhatsApp API";
    await supabase
      .from("messages")
      .update({ status: "failed", failure_reason: errMsg, status_updated_at: new Date().toISOString() })
      .eq("id", msgRecord.id);
    return { success: false, error: errMsg };
  }
}

async function executeFlow(supabase, flow, runId, ctx, contact, conversation, phoneNumberId, recipientPhone, accessToken) {
  const { nodes, edges } = flow.flow_data;
  if (!nodes?.length) return { executed: 0 };

  const edgesBySource = new Map();
  for (const edge of edges || []) {
    const existing = edgesBySource.get(edge.source) || [];
    existing.push(edge);
    edgesBySource.set(edge.source, existing);
  }

  const incomingEdges = new Set((edges || []).map((e) => e.target));
  const startNode = nodes.find((n) => !incomingEdges.has(n.id));
  if (!startNode) return { executed: 0, error: "No start node found" };

  let currentNode = startNode;
  let executed = 0;

  while (currentNode) {
    const stepType = currentNode.data.stepType;
    const config = currentNode.data.config;

    const logEntry = {
      run_id: runId,
      step_id: currentNode.id,
      action: stepType,
      result: {},
    };

    try {
      if (stepType === "send_message") {
        const msg = config.message;
        if (msg && phoneNumberId && recipientPhone) {
          const res = await sendWhatsAppMessage(
            supabase, ctx.tenant_id, ctx.conversation_id, ctx.contact_id,
            recipientPhone, msg, phoneNumberId, accessToken
          );
          logEntry.result = res;
          if (!res.success) logEntry.result = { error: res.error, skipped: true };
        } else if (msg) {
          logEntry.result = { warning: "Missing phone number config", skipped: true };
        }
      } else if (stepType === "condition") {
        const variable = config.variable;
        const operator = config.operator || "equals";
        const value = config.value || "";
        const actualValue = variable ? getContextValue(variable, ctx, contact) : undefined;
        const result = evaluateCondition(actualValue, operator, value);
        logEntry.result = { variable, operator, value, actualValue, result };
      } else if (stepType === "add_tag") {
        const tagName = config.tag;
        if (tagName) {
          const { data: existingTag } = await supabase
            .from("contact_tags")
            .select("id")
            .eq("tenant_id", ctx.tenant_id)
            .eq("name", tagName)
            .maybeSingle();
          let tagId = existingTag?.id;
          if (!tagId) {
            const { data: newTag } = await supabase
              .from("contact_tags")
              .insert({ tenant_id: ctx.tenant_id, name: tagName })
              .select("id")
              .single();
            tagId = newTag?.id;
          }
          if (tagId) {
            const { error: mapErr } = await supabase
              .from("contact_tag_map")
              .insert({ contact_id: ctx.contact_id, tag_id: tagId })
              .ignoreDuplicates();
            logEntry.result = mapErr ? { error: mapErr.message } : { tag: tagName, added: true };
          } else {
            logEntry.result = { error: "Failed to create tag" };
          }
        }
      } else if (stepType === "assign_agent") {
        const userId = config.user_id;
        if (userId) {
          const { error: assignErr } = await supabase
            .from("conversations")
            .update({ assigned_to: userId })
            .eq("id", ctx.conversation_id);
          logEntry.result = assignErr ? { error: assignErr.message } : { assigned_to: userId };
        }
      } else if (stepType === "api_call") {
        const apiUrl = config.url;
        const method = config.method || "POST";
        if (apiUrl) {
          try {
            const apiRes = await fetch(apiUrl, { method, headers: { "Content-Type": "application/json" } });
            const body = await apiRes.text();
            logEntry.result = { status: apiRes.status, body: body.slice(0, 500) };
          } catch (apiErr) {
            logEntry.result = { error: apiErr instanceof Error ? apiErr.message : "API call failed" };
          }
        }
      } else if (stepType === "wait") {
        const duration = config.duration || 1;
        logEntry.result = { duration, note: "Wait node encountered — continuing immediately (scheduling not yet implemented)" };
      }

      await supabase.from("automation_run_logs").insert({
        tenant_id: ctx.tenant_id,
        run_id: runId,
        action: stepType,
        result: { ...logEntry.result, nodeId: currentNode.id },
      });

      executed++;

      const outEdges = edgesBySource.get(currentNode.id) || [];

      if (stepType === "condition") {
        const condResult = logEntry.result.result;
        const branch = condResult ? "true" : "false";
        const nextEdge = outEdges.find((e) => e.sourceHandle === branch);
        currentNode = nextEdge ? nodes.find((n) => n.id === nextEdge.target) : undefined;
      } else {
        const nextEdge = outEdges[0];
        currentNode = nextEdge ? nodes.find((n) => n.id === nextEdge.target) : undefined;
      }
    } catch (stepErr) {
      const errMsg = stepErr instanceof Error ? stepErr.message : "Unknown step error";
      await supabase.from("automation_run_logs").insert({
        tenant_id: ctx.tenant_id,
        run_id: runId,
        action: stepType,
        result: { error: errMsg, nodeId: currentNode.id },
      });
      return { executed, error: `Step ${currentNode.id} (${stepType}): ${errMsg}` };
    }
  }

  return { executed };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const ctx = await req.json();
    if (!ctx.tenant_id || !ctx.contact_id || !ctx.conversation_id) {
      return new Response(
        JSON.stringify({ error: "tenant_id, contact_id, and conversation_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const [{ data: contact }, { data: conversation }] = await Promise.all([
      supabase.from("contacts").select("*").eq("id", ctx.contact_id).single(),
      supabase.from("conversations").select("*, phone_number:whatsapp_phone_numbers(*)").eq("id", ctx.conversation_id).single(),
    ]);

    if (!contact) {
      return new Response(JSON.stringify({ error: "Contact not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const phoneNumberIdFromConv = conversation?.phone_number?.phone_number_id;
    const account = await resolveAccount(supabase, ctx.project || contact.project || conversation?.project, phoneNumberIdFromConv);
    const phoneNumberId = account?.phone_number_id;
    const accessToken = account?.access_token;
    const recipientPhone = contact.phone_normalized;

    const triggerType = ctx.trigger_type || "inbound_message";

    const { data: existingRun } = await supabase
      .from("automation_runs")
      .select("*, flow:automation_flows(*)")
      .eq("contact_id", ctx.contact_id)
      .eq("status", "running")
      .maybeSingle();

    let flows = [];

    if (existingRun && existingRun.flow) {
      const f = existingRun.flow;
      if (f.status === "active") {
        flows = [f];
      }
    }

    if (flows.length === 0) {
      const { data: activeFlows } = await supabase
        .from("automation_flows")
        .select("id, name, flow_data, status, trigger_type")
        .eq("tenant_id", ctx.tenant_id)
        .eq("status", "active")
        .order("priority", { ascending: false });

      if (activeFlows) {
        flows = activeFlows
          .filter((f) => !f.trigger_type || f.trigger_type === triggerType);
      }
    }

    if (flows.length === 0) {
      return new Response(JSON.stringify({ runs: [], message: "No matching active flows" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = [];

    for (const flow of flows) {
      const { data: run, error: runError } = await supabase
        .from("automation_runs")
        .insert({
          tenant_id: ctx.tenant_id,
          flow_id: flow.id,
          contact_id: ctx.contact_id,
          conversation_id: ctx.conversation_id,
          status: "running",
          context: { message: ctx.message, trigger: triggerType },
        })
        .select()
        .single();

      if (runError || !run) {
        results.push({ flow_id: flow.id, flow_name: flow.name, status: "failed", error: runError?.message });
        continue;
      }

      const flowResult = await executeFlow(
        supabase, flow, run.id, ctx, contact, conversation,
        phoneNumberId, recipientPhone, accessToken
      );

      const finalStatus = flowResult.error ? "failed" : "completed";
      await supabase
        .from("automation_runs")
        .update({
          status: finalStatus,
          completed_at: finalStatus === "completed" ? new Date().toISOString() : undefined,
          error_message: flowResult.error || null,
        })
        .eq("id", run.id);

      results.push({
        flow_id: flow.id,
        flow_name: flow.name,
        status: finalStatus,
        steps_executed: flowResult.executed,
        error: flowResult.error || undefined,
      });
    }

    return new Response(JSON.stringify({ runs: results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Automation runner error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
