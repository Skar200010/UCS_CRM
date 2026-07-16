import supabase from '../config/supabase.js';
import {
  saveWorkerEducation,
  saveWorkerFamily,
  saveWorkerReferences,
  updateWorkerPersonalDetails,
  markOnboardingComplete,
  getOnboardingStatus,
  getActivePolicies,
  getAllPolicies,
  createPolicy,
  updatePolicy,
  deletePolicy,
  getFullWorkerProfile,
} from '../models/onboardingModel.js';

const BUCKET_NAME = 'worker-documents';

const ensureWorkerDocumentsBucket = async () => {
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some((b) => b.name === BUCKET_NAME);
  if (!exists) {
    const { error } = await supabase.storage.createBucket(BUCKET_NAME, { public: true });
    if (error) {
      console.warn('Could not create storage bucket:', error.message);
    } else {
      console.log('Created storage bucket:', BUCKET_NAME);
    }
  }
};

// ---- Submit complete onboarding data ----

export const submitOnboarding = async (req, res) => {
  try {
    const workerId = req.user.id;
    const {
      personal_details,
      education,
      family,
      references,
      previous_organizations,
    } = req.body;

    // 1. Save personal details
    if (personal_details) {
      if (previous_organizations) {
        personal_details.previous_organizations = previous_organizations;
      }
      await updateWorkerPersonalDetails(workerId, personal_details);
    }

    // 2. Save education
    if (education) {
      await saveWorkerEducation(workerId, education);
    }

    // 3. Save family
    if (family) {
      await saveWorkerFamily(workerId, family);
    }

    // 4. Save references
    if (references) {
      await saveWorkerReferences(workerId, references);
    }

    // 5. Mark onboarding as complete
    await markOnboardingComplete(workerId);

    return res.json({
      message: 'Onboarding completed successfully',
      success: true,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ---- Get onboarding status ----

export const checkOnboardingStatus = async (req, res) => {
  try {
    const workerId = req.user.id;
    const completed = await getOnboardingStatus(workerId);
    return res.json({ onboarding_completed: completed });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ---- Upload photo to Supabase Storage ----

export const uploadPhoto = async (req, res) => {
  try {
    await ensureWorkerDocumentsBucket();
    const workerId = req.user.id;
    const { photo_base64, mime_type } = req.body;

    if (!photo_base64) {
      return res.status(400).json({ message: 'Photo data is required' });
    }

    // Decode base64
    const buffer = Buffer.from(photo_base64, 'base64');
    const contentType = mime_type || 'image/jpeg';
    const ext = contentType.split('/')[1] || 'jpg';
    const fileName = `worker_photos/${workerId}_${Date.now()}.${ext}`;

    // Upload to Supabase Storage
    let { data: uploadData, error: uploadError } = await supabase.storage
      .from('worker-documents')
      .upload(fileName, buffer, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      // Try creating the bucket if it doesn't exist
      if (uploadError.message?.includes('bucket')) {
        const { error: bucketError } = await supabase.storage.createBucket('worker-documents', {
          public: true,
        });
        if (bucketError) {
          return res.status(500).json({ message: 'Failed to create storage bucket: ' + bucketError.message });
        }
        // Retry upload
        const { data: retryData, error: retryError } = await supabase.storage
          .from('worker-documents')
          .upload(fileName, buffer, { contentType, upsert: true });
        if (retryError) {
          return res.status(500).json({ message: 'Upload failed: ' + retryError.message });
        }
        uploadData = retryData;
      } else {
        return res.status(500).json({ message: 'Upload failed: ' + uploadError.message });
      }
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('worker-documents')
      .getPublicUrl(fileName);

    const photoUrl = publicUrlData?.publicUrl || `${process.env.SUPABASE_URL}/storage/v1/object/public/worker-documents/${fileName}`;

    // Save photo URL to worker record
    await updateWorkerPersonalDetails(workerId, { photo_url: photoUrl });

    return res.json({
      message: 'Photo uploaded successfully',
      photo_url: photoUrl,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ---- Upload document (aadhar front/back, pan card, bank proof) ----

export const uploadDocument = async (req, res) => {
  try {
    await ensureWorkerDocumentsBucket();
    const workerId = req.user.id;
    const { document_type, file_base64, mime_type } = req.body;

    if (!document_type || !file_base64) {
      return res.status(400).json({ message: 'Document type and file data are required' });
    }

    const allowedTypes = ['aadhar_front', 'aadhar_back', 'pan_card', 'bank_proof', 'light_bill'];
    if (!allowedTypes.includes(document_type)) {
      return res.status(400).json({ message: 'Invalid document type' });
    }

    const buffer = Buffer.from(file_base64, 'base64');
    const contentType = mime_type || 'image/jpeg';
    const ext = contentType.split('/')[1] || 'jpg';
    const fileName = `worker_documents/${workerId}/${document_type}_${Date.now()}.${ext}`;

    let { data: uploadData, error: uploadError } = await supabase.storage
      .from('worker-documents')
      .upload(fileName, buffer, { contentType, upsert: true });

    if (uploadError) {
      if (uploadError.message?.includes('bucket')) {
        const { error: bucketError } = await supabase.storage.createBucket('worker-documents', { public: true });
        if (bucketError) {
          return res.status(500).json({ message: 'Failed to create storage bucket: ' + bucketError.message });
        }
        const { data: retryData, error: retryError } = await supabase.storage
          .from('worker-documents')
          .upload(fileName, buffer, { contentType, upsert: true });
        if (retryError) {
          return res.status(500).json({ message: 'Upload failed: ' + retryError.message });
        }
        uploadData = retryData;
      } else {
        return res.status(500).json({ message: 'Upload failed: ' + uploadError.message });
      }
    }

    const { data: publicUrlData } = supabase.storage
      .from('worker-documents')
      .getPublicUrl(fileName);

    const documentUrl = publicUrlData?.publicUrl || `${process.env.SUPABASE_URL}/storage/v1/object/public/worker-documents/${fileName}`;

    return res.json({
      message: 'Document uploaded successfully',
      document_url: documentUrl,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ---- Admin: Upload photo for a specific worker ----

export const adminUploadPhoto = async (req, res) => {
  try {
    await ensureWorkerDocumentsBucket();
    const workerId = req.params.workerId;
    const { photo_base64, mime_type } = req.body;

    if (!photo_base64) {
      return res.status(400).json({ message: 'Photo data is required' });
    }

    const buffer = Buffer.from(photo_base64, 'base64');
    const contentType = mime_type || 'image/jpeg';
    const ext = contentType.split('/')[1] || 'jpg';
    const fileName = `worker_photos/${workerId}_${Date.now()}.${ext}`;

    let { data: uploadData, error: uploadError } = await supabase.storage
      .from('worker-documents')
      .upload(fileName, buffer, { contentType, upsert: true });

    if (uploadError) {
      if (uploadError.message?.includes('bucket')) {
        const { error: bucketError } = await supabase.storage.createBucket('worker-documents', { public: true });
        if (bucketError) {
          return res.status(500).json({ message: 'Failed to create storage bucket: ' + bucketError.message });
        }
        const { data: retryData, error: retryError } = await supabase.storage
          .from('worker-documents')
          .upload(fileName, buffer, { contentType, upsert: true });
        if (retryError) {
          return res.status(500).json({ message: 'Upload failed: ' + retryError.message });
        }
        uploadData = retryData;
      } else {
        return res.status(500).json({ message: 'Upload failed: ' + uploadError.message });
      }
    }

    const { data: publicUrlData } = supabase.storage
      .from('worker-documents')
      .getPublicUrl(fileName);

    const photoUrl = publicUrlData?.publicUrl || `${process.env.SUPABASE_URL}/storage/v1/object/public/worker-documents/${fileName}`;

    await updateWorkerPersonalDetails(workerId, { photo_url: photoUrl });

    return res.json({
      message: 'Photo uploaded successfully',
      photo_url: photoUrl,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ---- Get Company Policies (worker-facing) ----

export const getPolicies = async (req, res) => {
  try {
    const policies = await getActivePolicies();
    return res.json(policies);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ---- Get full profile (for print form) ----

export const getProfileForPrint = async (req, res) => {
  try {
    const workerId = req.user.id;
    const profile = await getFullWorkerProfile(workerId);
    const policies = await getActivePolicies();

    return res.json({
      profile,
      policies,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ---- Admin: Policy CRUD ----

export const adminGetPolicies = async (req, res) => {
  try {
    const policies = await getAllPolicies();
    return res.json(policies);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const adminAddPolicy = async (req, res) => {
  try {
    const { title, content, sort_order } = req.body;
    if (!title || !content) {
      return res.status(400).json({ message: 'Title and content are required' });
    }
    const policy = await createPolicy({
      title,
      content,
      sort_order: sort_order || 0,
    });
    return res.status(201).json(policy);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const adminEditPolicy = async (req, res) => {
  try {
    const { title, content, sort_order, is_active } = req.body;
    const updates = {};
    if (title !== undefined) updates.title = title;
    if (content !== undefined) updates.content = content;
    if (sort_order !== undefined) updates.sort_order = sort_order;
    if (is_active !== undefined) updates.is_active = is_active;

    const policy = await updatePolicy(req.params.id, updates);
    return res.json(policy);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const adminRemovePolicy = async (req, res) => {
  try {
    const result = await deletePolicy(req.params.id);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
