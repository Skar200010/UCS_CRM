import supabase from '../config/supabase.js';

// ---- Education ----

export const getWorkerEducation = async (workerId) => {
  const { data, error } = await supabase
    .from('worker_education')
    .select('*')
    .eq('worker_id', workerId)
    .order('year_of_passing', { ascending: false });
  if (error) throw error;
  return data;
};

export const saveWorkerEducation = async (workerId, educationList) => {
  // Delete existing records and insert new ones
  const { error: delError } = await supabase
    .from('worker_education')
    .delete()
    .eq('worker_id', workerId);
  if (delError) throw delError;

  if (!educationList || educationList.length === 0) return [];

  const records = educationList.map((e) => ({
    worker_id: workerId,
    degree: e.degree,
    institution: e.institution,
    university: e.university || null,
    year_of_passing: e.year_of_passing ? parseInt(e.year_of_passing, 10) : null,
    percentage: e.percentage || null,
    from_year: e.from_year || null,
    to_year: e.to_year || null,
    specialization: e.specialization || null,
  }));

  const { data, error } = await supabase
    .from('worker_education')
    .insert(records)
    .select();
  if (error) throw error;
  return data;
};

// ---- Family ----

export const getWorkerFamily = async (workerId) => {
  const { data, error } = await supabase
    .from('worker_family')
    .select('*')
    .eq('worker_id', workerId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
};

export const saveWorkerFamily = async (workerId, familyList) => {
  const { error: delError } = await supabase
    .from('worker_family')
    .delete()
    .eq('worker_id', workerId);
  if (delError) throw delError;

  if (!familyList || familyList.length === 0) return [];

  const records = familyList.map((f) => ({
    worker_id: workerId,
    name: f.name,
    relationship: f.relationship,
    occupation: f.occupation || null,
    phone: f.phone || null,
    dob: f.dob || null,
  }));

  const { data, error } = await supabase
    .from('worker_family')
    .insert(records)
    .select();
  if (error) throw error;
  return data;
};

// ---- References ----

export const getWorkerReferences = async (workerId) => {
  const { data, error } = await supabase
    .from('worker_references')
    .select('*')
    .eq('worker_id', workerId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
};

export const saveWorkerReferences = async (workerId, referenceList) => {
  const { error: delError } = await supabase
    .from('worker_references')
    .delete()
    .eq('worker_id', workerId);
  if (delError) throw delError;

  if (!referenceList || referenceList.length === 0) return [];

  const records = referenceList.map((r) => ({
    worker_id: workerId,
    name: r.name,
    designation: r.designation || null,
    organization: r.organization || null,
    phone: r.phone || null,
  }));

  const { data, error } = await supabase
    .from('worker_references')
    .insert(records)
    .select();
  if (error) throw error;
  return data;
};

// ---- Company Policies ----

export const getActivePolicies = async () => {
  const { data, error } = await supabase
    .from('company_policies')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data;
};

export const getAllPolicies = async () => {
  const { data, error } = await supabase
    .from('company_policies')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data;
};

export const createPolicy = async (policyData) => {
  const { data, error } = await supabase
    .from('company_policies')
    .insert([policyData])
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const updatePolicy = async (id, updates) => {
  const { data, error } = await supabase
    .from('company_policies')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const deletePolicy = async (id) => {
  const { error } = await supabase
    .from('company_policies')
    .delete()
    .eq('id', id);
  if (error) throw error;
  return { message: 'Policy deleted successfully' };
};

// ---- Worker personal details update ----

export const updateWorkerPersonalDetails = async (workerId, details) => {
  const updates = {};
  if (details.phone !== undefined) updates.phone = details.phone;
  if (details.alternate_phone !== undefined) updates.alternate_phone = details.alternate_phone;
  if (details.address !== undefined) updates.address = details.address;
  if (details.city !== undefined) updates.city = details.city;
  if (details.state !== undefined) updates.state = details.state;
  if (details.pincode !== undefined) updates.pincode = details.pincode;
  if (details.photo_url !== undefined) updates.photo_url = details.photo_url;
  if (details.name !== undefined) updates.name = details.name;
  if (details.email !== undefined) updates.email = details.email;
  if (details.gender !== undefined) updates.gender = details.gender;
  if (details.dob !== undefined) updates.dob = details.dob;
  if (details.aadhar_front_url !== undefined) updates.aadhar_front_url = details.aadhar_front_url;
  if (details.aadhar_back_url !== undefined) updates.aadhar_back_url = details.aadhar_back_url;
  if (details.pan_card_url !== undefined) updates.pan_card_url = details.pan_card_url;
  if (details.bank_proof_url !== undefined) updates.bank_proof_url = details.bank_proof_url;
  if (details.light_bill_url !== undefined) updates.light_bill_url = details.light_bill_url;
  if (details.account_holder_name !== undefined) updates.account_holder_name = details.account_holder_name;
  if (details.ifsc_code !== undefined) updates.ifsc_code = details.ifsc_code;
  if (details.account_number !== undefined) updates.account_number = details.account_number;
  if (details.declaration_date !== undefined) updates.declaration_date = details.declaration_date;
  if (details.declaration_place !== undefined) updates.declaration_place = details.declaration_place;
  if (details.father_husband_name !== undefined) updates.father_husband_name = details.father_husband_name;
  if (details.permanent_address !== undefined) updates.permanent_address = details.permanent_address;
  if (details.marital_status !== undefined) updates.marital_status = details.marital_status;
  if (details.pan_number !== undefined) updates.pan_number = details.pan_number;
  if (details.aadhar_number !== undefined) updates.aadhar_number = details.aadhar_number;
  if (details.bank_name !== undefined) updates.bank_name = details.bank_name;
  if (details.correspondence_address !== undefined) updates.correspondence_address = details.correspondence_address;
  if (details.correspondence_city !== undefined) updates.correspondence_city = details.correspondence_city;
  if (details.correspondence_state !== undefined) updates.correspondence_state = details.correspondence_state;
  if (details.correspondence_pincode !== undefined) updates.correspondence_pincode = details.correspondence_pincode;
  if (details.emergency_contact_name !== undefined) updates.emergency_contact_name = details.emergency_contact_name;
  if (details.emergency_contact_relation !== undefined) updates.emergency_contact_relation = details.emergency_contact_relation;
  if (details.emergency_contact_phone !== undefined) updates.emergency_contact_phone = details.emergency_contact_phone;
  if (details.previous_organizations !== undefined) updates.previous_organizations = details.previous_organizations;

  const { data, error } = await supabase
    .from('workers')
    .update(updates)
    .eq('id', workerId)
    .select()
    .single();
  if (error) throw error;
  return data;
};

// ---- Complete onboarding submission ----

export const markOnboardingComplete = async (workerId) => {
  const { data, error } = await supabase
    .from('workers')
    .update({ onboarding_completed: true })
    .eq('id', workerId)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const getOnboardingStatus = async (workerId) => {
  const { data, error } = await supabase
    .from('workers')
    .select('onboarding_completed')
    .eq('id', workerId)
    .single();
  if (error) throw error;
  return data?.onboarding_completed ?? false;
};

// ---- Get full worker profile with all onboarding data ----

export const getFullWorkerProfile = async (workerId) => {
  const worker = await supabase
    .from('workers')
    .select('*')
    .eq('id', workerId)
    .single();

  if (worker.error) throw worker.error;

  const [education, family, references] = await Promise.all([
    getWorkerEducation(workerId),
    getWorkerFamily(workerId),
    getWorkerReferences(workerId),
  ]);

  return {
    ...worker.data,
    education: education || [],
    family: family || [],
    references: references || [],
  };
};
