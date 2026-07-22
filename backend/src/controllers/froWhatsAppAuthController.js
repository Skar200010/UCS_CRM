import supabase from '../config/supabase.js';

export async function whatsappLogin(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const masterEmail = process.env.WHATSAPP_MASTER_EMAIL;
    const masterPassword = process.env.WHATSAPP_MASTER_PASSWORD;

    if (masterEmail && masterPassword && email === masterEmail && password === masterPassword) {
      return res.json({
        success: true,
        role: 'master',
        user: {
          id: 'master',
          name: 'Master Admin',
          email: masterEmail,
          role: 'master',
        },
        account: null,
      });
    }

    let userData = null;
    let token = null;

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (!authError && authData?.user) {
      const { data: dbUser } = await supabase
        .rpc('get_whatsapp_user', { p_id: authData.user.id });

      userData = typeof dbUser === 'string' ? JSON.parse(dbUser) : dbUser;
      token = authData.session?.access_token;
    }

    if (!userData) {
      const { data: agentData, error: agentErr } = await supabase
        .rpc('verify_agent', {
          p_email: email,
          p_password: password,
        });

      if (agentErr || !agentData) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      userData = typeof agentData === 'string' ? JSON.parse(agentData) : agentData;
      token = 'rpc_' + userData.id;
    }

    const { data: assignment } = await supabase
      .from('agent_phone_assignments')
      .select('*, whatsapp_accounts!inner(id, name, project, phone_number_id)')
      .eq('user_id', userData.id)
      .maybeSingle();

    const account = assignment?.whatsapp_accounts || null;

    return res.json({
      success: true,
      token,
      user: {
        id: userData.id,
        name: userData.name || userData.first_name || email.split('@')[0],
        email: userData.email || email,
        role: userData.role || 'agent',
      },
      account,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}
