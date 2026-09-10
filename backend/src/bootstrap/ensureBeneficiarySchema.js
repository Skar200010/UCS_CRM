import db from '../config/db.js';

export async function ensureBeneficiarySchema() {
  const tables = [
    'beneficiary_categories', 'beneficiaries', 'beneficiary_category_assignments',
    'beneficiary_disabilities', 'beneficiary_family_members', 'beneficiary_education',
    'beneficiary_employment', 'beneficiary_assistance_requirements', 'beneficiary_documents',
    'beneficiary_source_records', 'import_batches', 'import_rows',
    'beneficiary_cards', 'biometric_credentials', 'bnf_programs',
    'program_volunteer_requirements', 'program_beneficiary_requirements',
    'program_beneficiaries', 'program_service_requirements', 'program_requirements',
    'program_volunteers', 'bnf_volunteers', 'benefits', 'benefit_eligibility_rules',
    'benefit_distributions', 'benefit_distribution_items', 'beneficiary_audit_logs',
    'beneficiary_sequences',
  ];

  for (const t of tables) {
    await db._pool.query(`CREATE TABLE IF NOT EXISTS ${t} (id SERIAL PRIMARY KEY)`).catch(() => {});
  }

  // Beneficiary Categories seed
  const categories = [
    ['Visually Impaired', 'Beneficiaries with visual impairment'],
    ['Children', 'Child beneficiaries under 18'],
    ['Senior Citizens', 'Elderly beneficiaries above 60'],
    ['Women', 'Women beneficiaries'],
    ['Underprivileged Families', 'Families from economically weaker sections'],
    ['Persons with Disabilities', 'Beneficiaries with various disabilities'],
    ['Other', 'Other beneficiaries'],
  ];
  for (const [name, description] of categories) {
    await db._pool.query(
      `INSERT INTO beneficiary_categories (name, description) SELECT $1, $2 WHERE NOT EXISTS (SELECT 1 FROM beneficiary_categories WHERE name = $1)`,
      [name, description]
    ).catch(() => {});
  }

  // Benefits seed
  const benefitsList = [
    ['Nutrition Kit', 'Monthly nutrition support kit', 'Food'],
    ['Education Kit', 'School supplies and educational materials', 'Education'],
    ['White Cane', 'White cane for visually impaired', 'Assistive Device'],
    ['Talking Watch', 'Audio-enabled watch for visually impaired', 'Assistive Device'],
    ['Braille Notebook', 'Braille notepad for writing', 'Assistive Device'],
    ['Braille Slate & Stylus', 'Braille writing tools', 'Assistive Device'],
    ['Computer / Laptop', 'Computer or laptop for education/employment', 'Technology'],
    ['Clothing', 'Clothing assistance', 'Essential'],
    ['Accommodation', 'Housing/shelter support', 'Essential'],
    ['Financial Assistance', 'Direct financial support', 'Financial'],
    ['Scholarship', 'Educational scholarship', 'Education'],
    ['Medical Assistance', 'Medical treatment and medicine support', 'Health'],
    ['Travel Assistance', 'Travel fare support', 'Transport'],
    ['Festival Kit', 'Festival celebration kit', 'Essential'],
  ];
  for (const [name, description, category] of benefitsList) {
    await db._pool.query(
      `INSERT INTO benefits (name, description, category) SELECT $1, $2, $3 WHERE NOT EXISTS (SELECT 1 FROM benefits WHERE name = $1)`,
      [name, description, category]
    ).catch(() => {});
  }

  // Sequence table
  await db._pool.query(
    `CREATE TABLE IF NOT EXISTS beneficiary_sequences (id SERIAL PRIMARY KEY, current_value INT DEFAULT 0, updated_at TIMESTAMPTZ DEFAULT NOW())`
  ).catch(() => {});
  await db._pool.query(
    `INSERT INTO beneficiary_sequences (current_value) SELECT 0 WHERE NOT EXISTS (SELECT 1 FROM beneficiary_sequences)`
  ).catch(() => {});
}
