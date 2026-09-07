export const NOT_CONNECTED = [
  { id: 'busy', label: 'Busy' },
  { id: 'ringing', label: 'Ringing' },
  { id: 'call_waiting', label: 'Call Waiting' },
  { id: 'switched_off', label: 'Switched Off' },
  { id: 'out_of_coverage', label: 'Out of Coverage' },
  { id: 'unreachable', label: 'Unreachable' },
  { id: 'wrong_number', label: 'Wrong Number' },
  { id: 'invalid', label: 'Invalid' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'temporary_network_issue', label: 'Temporary Network Issue' },
  { id: 'voicemail', label: 'Voicemail' },
  { id: 'incoming_out', label: 'Incoming Out' },
];

export const CONNECTED = [
  { id: 'scheduled', label: 'Follow Up' },
  { id: 'callback', label: 'Callback' },
  { id: 'office_visit_scheduled', label: 'Office Visit Scheduled' },
  { id: 'program_visit_scheduled', label: 'Program Visit Scheduled' },
  { id: 'visit_donate', label: 'Visit & Donate' },
  { id: 'will_donate_online', label: 'Will Donate Online' },
  { id: 'promise_to_pay', label: 'Promise to Pay' },
  { id: 'payment_pending', label: 'Payment Pending' },
  { id: 'already_donated', label: 'Already Donated' },
  { id: 'email_sent', label: 'Email Sent' },
  { id: 'whatsapp_sent', label: 'WhatsApp Sent' },
  { id: 'csr_inquiry', label: 'CSR Inquiry' },
  { id: 'wants_80g_details', label: 'Wants 80G Details' },
  { id: 'wants_trust_documents', label: 'Wants Trust Documents' },
  { id: 'not_interested_now', label: 'Not Interested Now' },
  { id: 'not_interested', label: 'Not Interested' },
  { id: 'language_barrier', label: 'Language Barrier' },
  { id: 'transferred_senior', label: 'Transferred to Senior' },
  { id: 'query_complaint', label: 'Query/Complaint' },
  { id: 'receipt_request', label: 'Request Receipt/Info' },
  { id: 'dnd', label: 'DND (Do Not Disturb)' },
  { id: 'wrong_person', label: 'Wrong Person' },
  { id: 'call_disconnected', label: 'Call Disconnected' },
  { id: 'not_possible', label: 'Not Possible' },
];

export const ALL_DISPOSITIONS = [...NOT_CONNECTED, ...CONNECTED];

// Grouped picker lists for "My Leads" / donor dispositions. The FRO picks a
// top-level group; multi-item groups expand to the exact disposition stored.
export const CONNECTED_GROUPS = [
  { label: 'Follow Up', items: [{ id: 'scheduled', label: 'Follow Up' }] },
  { label: 'Callback', items: [{ id: 'callback', label: 'Callback' }] },
  {
    label: 'Office / Program Visit',
    items: [
      { id: 'office_visit_scheduled', label: 'Office Visit' },
      { id: 'program_visit_scheduled', label: 'Program Visit' },
    ],
  },
  {
    label: 'Promise to Pay / WA Sent / Email Sent',
    items: [
      { id: 'promise_to_pay', label: 'Promise to Pay' },
      { id: 'whatsapp_sent', label: 'WhatsApp Sent' },
      { id: 'email_sent', label: 'Email Sent' },
    ],
  },
  {
    label: 'Not Interested / Call Disconnected / NP',
    items: [
      { id: 'not_interested', label: 'Not Interested' },
      { id: 'call_disconnected', label: 'Call Disconnected' },
      { id: 'not_possible', label: 'Not Possible' },
    ],
  },
  { label: 'DND', items: [{ id: 'dnd', label: 'DND (Do Not Disturb)' }] },
  {
    label: 'Others',
    items: [
      { id: 'visit_donate', label: 'Visit & Donate' },
      { id: 'will_donate_online', label: 'Will Donate Online' },
      { id: 'payment_pending', label: 'Payment Pending' },
      { id: 'already_donated', label: 'Already Donated' },
      { id: 'csr_inquiry', label: 'CSR Inquiry' },
      { id: 'wants_80g_details', label: 'Wants 80G Details' },
      { id: 'wants_trust_documents', label: 'Wants Trust Documents' },
      { id: 'not_interested_now', label: 'Not Interested Now' },
      { id: 'language_barrier', label: 'Language Barrier' },
      { id: 'transferred_senior', label: 'Transferred to Senior' },
      { id: 'query_complaint', label: 'Query/Complaint' },
      { id: 'receipt_request', label: 'Request Receipt/Info' },
      { id: 'wrong_person', label: 'Wrong Person' },
    ],
  },
];

export const NOT_CONNECTED_GROUPS = [
  {
    label: 'Busy / Call Waiting',
    items: [
      { id: 'busy', label: 'Busy' },
      { id: 'call_waiting', label: 'Call Waiting' },
    ],
  },
  {
    label: 'OOC / Unreachable / Network Issue',
    items: [
      { id: 'out_of_coverage', label: 'Out of Coverage' },
      { id: 'unreachable', label: 'Unreachable' },
      { id: 'temporary_network_issue', label: 'Temporary Network Issue' },
    ],
  },
  {
    label: 'Ringing / Voicemail',
    items: [
      { id: 'ringing', label: 'Ringing' },
      { id: 'voicemail', label: 'Voicemail' },
    ],
  },
  { label: 'Switched Off', items: [{ id: 'switched_off', label: 'Switched Off' }] },
  {
    label: 'Others',
    items: [
      { id: 'wrong_number', label: 'Wrong Number' },
      { id: 'invalid', label: 'Invalid' },
      { id: 'rejected', label: 'Rejected' },
      { id: 'incoming_out', label: 'Incoming Out' },
    ],
  },
];
export const CONNECTED_IDS = new Set(CONNECTED.map(d => d.id));
export const NOT_CONNECTED_IDS = new Set(NOT_CONNECTED.map(d => d.id));
export const isConnected = (id) => CONNECTED_IDS.has(id);
export const findDisp = (id) => ALL_DISPOSITIONS.find(d => d.id === id);

// Assignment status values (as stored in fro_assignments.status).
export const NOT_CONNECTED_STATUSES = ['busy', 'ringing', 'call_waiting', 'unreachable', 'switched_off', 'out_of_coverage', 'wrong_number', 'invalid_number', 'rejected', 'temporary_network_issue', 'voicemail', 'incoming_out'];
export const CONNECTED_STATUSES = ['contacted', 'donation_collected', 'lead_done', 'done', 'follow_up', 'scheduled', 'callback', 'visit_donate', 'will_donate_online', 'promise_to_pay', 'payment_pending', 'already_donated', 'email_sent', 'whatsapp_sent', 'csr_inquiry', 'wants_80g_details', 'wants_trust_documents', 'language_barrier', 'transferred_senior', 'query_complaint', 'receipt_request', 'not_interested_now', 'not_interested', 'dnd', 'wrong_person', 'call_disconnected'];

export const DISPOSITION_ORDER = {};
NOT_CONNECTED.forEach((d, i) => { DISPOSITION_ORDER[d.id] = i + 1; });
CONNECTED.forEach((d, i) => { DISPOSITION_ORDER[d.id] = i + 1 + NOT_CONNECTED.length; });

// Dispositions that need a date + time picker when scheduling.
export const SCHEDULE_DATE_TYPES = new Set(['scheduled', 'office_visit_scheduled', 'program_visit_scheduled']);
// Dispositions that need only a time picker (stamped on today/tomorrow).
export const SCHEDULE_TIME_TYPES = new Set(['callback']);
// All dispositions that result in a scheduled contact entry.
export const SCHEDULE_TYPES = new Set([...SCHEDULE_DATE_TYPES, ...SCHEDULE_TIME_TYPES]);

export const STATUS_PILL_MAP = {
  pending: 'pill-yellow', contacted: 'pill-blue', scheduled: 'pill-purple',
  callback: 'pill-purple', follow_up: 'pill-purple', busy: 'pill-gray', ringing: 'pill-gray',
  call_waiting: 'pill-gray', unreachable: 'pill-gray', switched_off: 'pill-gray',
  out_of_coverage: 'pill-gray', wrong_number: 'pill-gray', invalid_number: 'pill-gray',
  rejected: 'pill-red', temporary_network_issue: 'pill-gray', voicemail: 'pill-gray',
  incoming_out: 'pill-gray',
  lead_done: 'pill-green', done: 'pill-green', visit_donate: 'pill-green',
  will_donate_online: 'pill-blue', donation_collected: 'pill-green', promise_to_pay: 'pill-blue',
  payment_pending: 'pill-yellow', already_donated: 'pill-gray', email_sent: 'pill-blue',
  whatsapp_sent: 'pill-blue', csr_inquiry: 'pill-yellow', wants_80g_details: 'pill-blue',
  wants_trust_documents: 'pill-blue', not_interested: 'pill-red', not_interested_now: 'pill-red',
  language_barrier: 'pill-gray', transferred_senior: 'pill-blue', query_complaint: 'pill-yellow',
  receipt_request: 'pill-blue', dnd: 'pill-red', wrong_person: 'pill-gray',
  call_disconnected: 'pill-gray', payment_rejected: 'pill-red',
};
