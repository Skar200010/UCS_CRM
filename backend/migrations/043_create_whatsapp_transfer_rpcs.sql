CREATE OR REPLACE FUNCTION transfer_conversation(
  p_conversation_id UUID,
  p_target_agent_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_conversation conversations%ROWTYPE;
BEGIN
  UPDATE conversations
  SET assigned_agent_id = p_target_agent_id,
      updated_at = NOW()
  WHERE id = p_conversation_id
  RETURNING * INTO v_conversation;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Conversation not found');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'conversation_id', v_conversation.id,
    'assigned_agent_id', v_conversation.assigned_agent_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION claim_conversation(
  p_conversation_id UUID,
  p_agent_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_agent UUID;
  v_conversation conversations%ROWTYPE;
BEGIN
  SELECT assigned_agent_id INTO v_current_agent
  FROM conversations
  WHERE id = p_conversation_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Conversation not found');
  END IF;

  IF v_current_agent IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Conversation is already assigned to another agent');
  END IF;

  UPDATE conversations
  SET assigned_agent_id = p_agent_id,
      updated_at = NOW()
  WHERE id = p_conversation_id
  RETURNING * INTO v_conversation;

  RETURN jsonb_build_object(
    'success', true,
    'conversation_id', v_conversation.id,
    'assigned_agent_id', v_conversation.assigned_agent_id
  );
END;
$$;
