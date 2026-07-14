import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { loadMetaCredentials, getCachedToken, getCachedWabaId } from '../lib/metaCredentials';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { Save, FileImage, FileVideo, FileText, Upload, PlusCircle, XCircle, ArrowLeft, MessageSquare, ShoppingBag, ClipboardList, Truck, CreditCard, PhoneCall, KeyRound, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import type { WhatsAppTemplate } from 'shared';

const WHATSAPP_API = 'https://graph.facebook.com/v19.0';
const LANGUAGES = [
  { label: 'Afrikaans', value: 'af' },
  { label: 'Albanian', value: 'sq' },
  { label: 'Arabic', value: 'ar' },
  { label: 'Azerbaijani', value: 'az' },
  { label: 'Bengali', value: 'bn' },
  { label: 'Bulgarian', value: 'bg' },
  { label: 'Catalan', value: 'ca' },
  { label: 'Chinese (CHN)', value: 'zh_CN' },
  { label: 'Chinese (HKG)', value: 'zh_HK' },
  { label: 'Chinese (TAI)', value: 'zh_TW' },
  { label: 'Croatian', value: 'hr' },
  { label: 'Czech', value: 'cs' },
  { label: 'Danish', value: 'da' },
  { label: 'Dutch', value: 'nl' },
  { label: 'English', value: 'en' },
  { label: 'English (UAE)', value: 'en_AE' },
  { label: 'English (AUS)', value: 'en_AU' },
  { label: 'English (GB)', value: 'en_GB' },
  { label: 'English (IN)', value: 'en_IN' },
  { label: 'English (US)', value: 'en_US' },
  { label: 'Estonian', value: 'et' },
  { label: 'Filipino', value: 'fil' },
  { label: 'Finnish', value: 'fi' },
  { label: 'French', value: 'fr' },
  { label: 'German', value: 'de' },
  { label: 'German (CHE)', value: 'de_CH' },
  { label: 'Greek', value: 'el' },
  { label: 'Gujarati', value: 'gu' },
  { label: 'Hebrew', value: 'he' },
  { label: 'Hindi', value: 'hi' },
  { label: 'Hungarian', value: 'hu' },
  { label: 'Indonesian', value: 'id' },
  { label: 'Irish', value: 'ga' },
  { label: 'Italian', value: 'it' },
  { label: 'Japanese', value: 'ja' },
  { label: 'Kannada', value: 'kn' },
  { label: 'Korean', value: 'ko' },
  { label: 'Malayalam', value: 'ml' },
  { label: 'Marathi', value: 'mr' },
  { label: 'Norwegian', value: 'nb' },
  { label: 'Polish', value: 'pl' },
  { label: 'Portuguese (BR)', value: 'pt_BR' },
  { label: 'Portuguese (PT)', value: 'pt_PT' },
  { label: 'Punjabi', value: 'pa' },
  { label: 'Romanian', value: 'ro' },
  { label: 'Russian', value: 'ru' },
  { label: 'Spanish', value: 'es' },
  { label: 'Spanish (ARG)', value: 'es_AR' },
  { label: 'Spanish (SPA)', value: 'es_ES' },
  { label: 'Spanish (MEX)', value: 'es_MX' },
  { label: 'Swedish', value: 'sv' },
  { label: 'Tamil', value: 'ta' },
  { label: 'Telugu', value: 'te' },
  { label: 'Turkish', value: 'tr' },
  { label: 'Ukrainian', value: 'uk' },
  { label: 'Urdu', value: 'ur' },
];
const HEADER_TYPES = ['NONE', 'TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT'] as const;
const BUTTON_TYPES = ['URL', 'PHONE_NUMBER', 'QUICK_REPLY', 'FLOW', 'COPY_CODE'] as const;

type HeaderType = typeof HEADER_TYPES[number];
type ButtonType = typeof BUTTON_TYPES[number];

interface TemplateButton {
  type: ButtonType;
  text: string;
  url?: string;
  phone_number?: string;
  flow_id?: string;
  copy_code?: string;
}

const TEMPLATE_TYPES: { id: string; label: string; icon: any; desc: string; cats: string[] }[] = [
  { id: 'DEFAULT', label: 'Default', icon: MessageSquare, desc: 'Send messages with media and customized buttons to engage your customers.', cats: ['MARKETING', 'UTILITY'] },
  { id: 'CATALOG', label: 'Catalog', icon: ShoppingBag, desc: 'Send messages that drive sales by connecting your product catalog.', cats: ['MARKETING'] },
  { id: 'FLOWS', label: 'Flows', icon: ClipboardList, desc: 'Send a form to capture customer interests, appointment requests or run surveys.', cats: ['MARKETING', 'UTILITY'] },
  { id: 'ORDER_STATUS', label: 'Order Status', icon: Truck, desc: 'Send messages to tell customers about the progress of their orders.', cats: ['UTILITY'] },
  { id: 'ORDER_DETAILS', label: 'Order Details', icon: CreditCard, desc: 'Send messages through which customers can pay you.', cats: ['MARKETING', 'UTILITY'] },
  { id: 'CALLING', label: 'Calling permissions request', icon: PhoneCall, desc: 'Ask customers if you can call them on WhatsApp.', cats: ['MARKETING', 'UTILITY'] },
  { id: 'OTP', label: 'One-time Passcode', icon: KeyRound, desc: 'Send codes to verify a transaction or login.', cats: ['AUTHENTICATION'] },
];

const STEPS = ['Set up template', 'Edit template', 'Submit for review'];

function getAccessToken(): string {
  let token = getCachedToken();
  if (!token) { token = prompt('Enter your WhatsApp Access Token:') || ''; if (token) localStorage.setItem('wa_access_token', token); }
  return token;
}

function getWabaId(): string {
  let wabaId = getCachedWabaId();
  if (!wabaId) { wabaId = prompt('Enter your WABA ID:') || ''; if (wabaId) localStorage.setItem('waba_id', wabaId); }
  return wabaId;
}

function extractVariables(text: string): string[] {
  const matches = text.match(/\{\{(.*?)\}\}/g);
  if (!matches) return [];
  return matches.map((m) => m.replace(/\{\{|\}\}/g, '').trim()).filter((v, i, a) => a.indexOf(v) === i);
}

export function TemplateEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = !!id;
  const [step, setStep] = useState(0);

  const { data: template, isLoading: loadingTemplate } = useQuery<WhatsAppTemplate | null>({
    queryKey: ['template-edit', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase.from('whatsapp_templates').select('*').eq('id', id).single();
      if (error) throw error;
      return data as WhatsAppTemplate;
    },
    enabled: !!id,
  });

  const existingComponents = (template?.components as unknown as any[]) || [];
  const existingHeader = existingComponents.find((c: any) => c.type === 'HEADER');
  const existingBody = existingComponents.find((c: any) => c.type === 'BODY');
  const existingFooter = existingComponents.find((c: any) => c.type === 'FOOTER');
  const existingButtons = existingComponents.find((c: any) => c.type === 'BUTTONS');

  const [name, setName] = useState('');
  const [templateType, setTemplateType] = useState('DEFAULT');
  const [category, setCategory] = useState('');
  const [language, setLanguage] = useState('en');
  const [headerType, setHeaderType] = useState<HeaderType>('NONE');
  const [headerText, setHeaderText] = useState('');
  const [headerMediaFile, setHeaderMediaFile] = useState<File | null>(null);
  const [bodyText, setBodyText] = useState('');
  const [footerText, setFooterText] = useState('');
  const [buttons, setButtons] = useState<TemplateButton[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!template) return;
    setName(template.name);
    setLanguage(template.language);
    setCategory(template.category?.toUpperCase() || '');
    setTemplateType('DEFAULT');
    setHeaderType(
      existingHeader?.format === 'TEXT' ? 'TEXT' :
      existingHeader?.format === 'IMAGE' ? 'IMAGE' :
      existingHeader?.format === 'VIDEO' ? 'VIDEO' :
      existingHeader?.format === 'DOCUMENT' ? 'DOCUMENT' : 'NONE'
    );
    setHeaderText(existingHeader?.text || '');
    setBodyText(existingBody?.text || '');
    setFooterText(existingFooter?.text || '');
    setButtons(
      existingButtons?.buttons?.map((b: any) => ({
        type: b.type as ButtonType,
        text: b.text,
        url: b.url,
        phone_number: b.phone_number,
      })) || []
    );
  }, [template]);

  useEffect(() => { loadMetaCredentials(); }, []);

  const variables = extractVariables(bodyText);
  const [variableSamples, setVariableSamples] = useState<Record<string, string>>({});

  useEffect(() => {
    const vars = extractVariables(bodyText);
    setVariableSamples((prev) => {
      const next: Record<string, string> = {};
      vars.forEach((v) => { next[v] = prev[v] || ''; });
      return next;
    });
  }, [bodyText]);

  const handleNext = () => {
    if (step === 0 && !isEdit && !category) { toast.error('Select a template type'); return; }
    if (step < 2) setStep(step + 1);
  };

  const handleSave = async () => {
    if (!bodyText) { toast.error('Body text is required'); return; }
    setSaving(true);

    const accessToken = getAccessToken();
    const wabaId = getWabaId();
    if (!accessToken || !wabaId) { setSaving(false); return; }

    const components: any[] = [];
    if (headerType === 'TEXT' && headerText) components.push({ type: 'HEADER', format: 'TEXT', text: headerText });
    else if (headerType === 'IMAGE') components.push({ type: 'HEADER', format: 'IMAGE' });
    else if (headerType === 'VIDEO') components.push({ type: 'HEADER', format: 'VIDEO' });
    else if (headerType === 'DOCUMENT') components.push({ type: 'HEADER', format: 'DOCUMENT' });
    if (bodyText) components.push({ type: 'BODY', text: bodyText });
    if (footerText) components.push({ type: 'FOOTER', text: footerText });
    if (buttons.length > 0) {
      components.push({
        type: 'BUTTONS',
        buttons: buttons.map((b) => {
          if (b.type === 'URL') return { type: 'URL', text: b.text, url: b.url || 'https://example.com' };
          if (b.type === 'PHONE_NUMBER') return { type: 'PHONE_NUMBER', text: b.text, phone_number: b.phone_number || '+1234567890' };
          if (b.type === 'FLOW') return { type: 'FLOW', text: b.text, flow_id: b.flow_id || '' };
          if (b.type === 'COPY_CODE') return { type: 'COPY_CODE', text: b.text, copy_code: b.copy_code || '' };
          return { type: 'QUICK_REPLY', text: b.text };
        }),
      });
    }

    try {
      const metaTemplateId = template?.meta_template_id;
      const url = metaTemplateId ? `${WHATSAPP_API}/${metaTemplateId}` : `${WHATSAPP_API}/${wabaId}/message_templates`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(metaTemplateId ? {} : { name, language, category }),
          components,
          ...(templateType === 'CATALOG' ? { sub_category: 'CATALOG' } : {}),
        }),
      });
      const result = await resp.json();
      if (!resp.ok) throw new Error(JSON.stringify(result.error));
      toast.success(metaTemplateId ? 'Template updated' : 'Template created');
      queryClient.invalidateQueries({ queryKey: ['whatsapp-templates'] });
      navigate('/templates');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  if (isEdit && loadingTemplate) {
    return <div className="space-y-6"><div className="h-8 w-48 animate-pulse rounded bg-muted" /><div className="h-[600px] animate-pulse rounded-lg bg-muted" /></div>;
  }

  const previewBody = bodyText.replace(/\{\{(.*?)\}\}/g, (_: string, v: string) => {
    const sample = variableSamples[v.trim()];
    return sample ? `<span class="text-primary font-medium">${sample}</span>` : `<span class="text-muted-foreground italic">{{${v.trim()}}}</span>`;
  });

  const preview = (
    <div className="w-80 shrink-0 hidden lg:block">
      <div className="sticky top-6">
        <Card>
          <CardContent className="pt-6">
            <div className="mx-auto w-[260px] rounded-3xl border-[3px] border-gray-300 bg-white p-3 shadow-xl">
              <div className="flex items-center justify-center gap-2 pb-2 text-[10px] text-gray-400">
                <span className="h-1 w-12 rounded-full bg-gray-300" />
                <span>9:41</span>
                <span className="h-1 w-12 rounded-full bg-gray-300" />
              </div>
              <div className="rounded-lg bg-green-100 p-3 text-xs">
                {headerType !== 'NONE' && (
                  <div className="mb-2">
                    {headerType === 'TEXT' && headerText && <p className="font-semibold text-gray-800 text-sm mb-1">{headerText}</p>}
                    {(headerType === 'IMAGE' || headerType === 'VIDEO' || headerType === 'DOCUMENT') && (
                      <div className="flex items-center justify-center h-20 rounded-md bg-gray-200 mb-2">
                        {headerType === 'IMAGE' && <FileImage className="h-6 w-6 text-gray-400" />}
                        {headerType === 'VIDEO' && <FileVideo className="h-6 w-6 text-gray-400" />}
                        {headerType === 'DOCUMENT' && <FileText className="h-6 w-6 text-gray-400" />}
                      </div>
                    )}
                  </div>
                )}
                {bodyText ? (
                  <p className="text-gray-700 leading-relaxed whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: previewBody } as any} />
                ) : (
                  <p className="text-gray-400 italic">Body text...</p>
                )}
                {footerText && <p className="mt-2 pt-2 border-t border-green-200 text-gray-500 text-[10px]">{footerText}</p>}
                {buttons.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {buttons.map((btn, i) => (
                      <div key={i} className="rounded-md bg-white py-2 px-3 text-center text-[11px] font-medium text-green-700 border border-green-200">
                        {btn.text || `[${btn.type}]`}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <p className="mt-3 text-center text-[10px] text-muted-foreground">Preview — actual appearance may vary on WhatsApp.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/templates')}><ArrowLeft className="h-5 w-5" /></Button>
        <div>
          <h1 className="text-2xl font-bold">{isEdit ? `Edit: ${template?.name}` : 'Create Template'}</h1>
          <p className="text-sm text-muted-foreground">{isEdit ? 'Update template components' : 'Create a new WhatsApp message template'}</p>
        </div>
      </div>

      <div className="flex items-center gap-0 border rounded-lg bg-card">
        {STEPS.map((s, i) => (
          <button key={s} onClick={() => i <= step && setStep(i)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
              i === step ? 'bg-primary/10 text-primary' : i < step ? 'text-green-600' : 'text-muted-foreground'
            } ${i > 0 ? 'border-l' : ''} ${i < step ? 'cursor-pointer' : ''} ${i === step ? '' : ''}`}>
            {i < step ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <span className="flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-bold">{i + 1}</span>}
            {s}
          </button>
        ))}
      </div>

      <div className="flex gap-6">
        <div className="flex-1">
          {step === 0 && (
            <Card>
              <CardContent className="pt-6 space-y-5">
                {isEdit && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Template Name</Label>
                    <p className="text-lg font-semibold">{name}</p>
                  </div>
                )}

                {!isEdit && (
                  <div className="space-y-2.5">
                    <div>
                      <Label className="text-xs font-medium">Set up your template</Label>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Choose the category and type that best describes your message template.</p>
                    </div>

                    <div className="flex gap-1.5">
                      {['MARKETING', 'UTILITY', 'AUTHENTICATION'].map((cat) => (
                        <button key={cat} onClick={() => { setCategory(cat); setTemplateType(TEMPLATE_TYPES.find((tt) => tt.cats.includes(cat))?.id || 'DEFAULT'); }}
                          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium text-center transition-colors ${
                            category === cat
                              ? cat === 'MARKETING' ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-300'
                                : cat === 'UTILITY' ? 'bg-purple-100 text-purple-700 ring-1 ring-purple-300'
                                : 'bg-orange-100 text-orange-700 ring-1 ring-orange-300'
                              : 'bg-muted text-muted-foreground hover:bg-accent'
                          }`}>
                          {cat === 'MARKETING' ? 'Marketing' : cat === 'UTILITY' ? 'Utility' : 'Authentication'}
                        </button>
                      ))}
                    </div>

                    <div className="grid gap-1.5 sm:grid-cols-2">
                      {TEMPLATE_TYPES.filter((tt) => tt.cats.includes(category)).map((tt) => {
                        const Icon = tt.icon;
                        return (
                          <button key={tt.id} onClick={() => setTemplateType(tt.id)}
                            className={`text-left rounded-md border px-2.5 py-2 transition-colors ${templateType === tt.id ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-accent'}`}>
                            <div className="flex items-center gap-1.5">
                              <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <p className="text-xs font-medium leading-tight">{tt.label}</p>
                            </div>
                            <p className="text-[9px] text-muted-foreground mt-0.5 leading-tight line-clamp-1">{tt.desc}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => navigate('/templates')}>Cancel</Button>
                  <Button onClick={handleNext}>Next</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 1 && (
            <Card>
              <CardContent className="pt-6 space-y-5">
                <div className="flex gap-4 items-start">
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <Label className="text-xs font-medium">Template Name</Label>
                    {isEdit ? (
                      <p className="text-base font-semibold truncate">{name}</p>
                    ) : (
                      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="receipts" className="h-8 text-sm" />
                    )}
                  </div>
                  <div className="w-48 shrink-0 space-y-1.5">
                    <Label className="text-xs font-medium">Language</Label>
                    <select value={language} onChange={(e) => setLanguage(e.target.value)}
                      className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs">
                      {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-xs font-medium">Header</Label>
                  <div className="grid gap-3 sm:grid-cols-5">
                    {HEADER_TYPES.map((ht) => (
                      <button key={ht} onClick={() => setHeaderType(ht)}
                        className={`rounded-md border px-3 py-2 text-xs font-medium transition-colors ${headerType === ht ? 'border-primary bg-primary/5 text-primary' : 'border-input hover:bg-accent'}`}>
                        {ht === 'NONE' ? 'None' : ht === 'TEXT' ? 'Text' : ht === 'IMAGE' ? 'Image' : ht === 'VIDEO' ? 'Video' : 'Document'}
                      </button>
                    ))}
                  </div>
                  {headerType === 'TEXT' && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Header Text (max 60 chars)</Label>
                      <Input value={headerText} onChange={(e) => setHeaderText(e.target.value.slice(0, 60))} placeholder="Short header line" />
                      <p className="text-[10px] text-muted-foreground text-right">{headerText.length}/60</p>
                    </div>
                  )}
                  {(headerType === 'IMAGE' || headerType === 'VIDEO' || headerType === 'DOCUMENT') && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">{headerType === 'IMAGE' ? 'Upload Image' : headerType === 'VIDEO' ? 'Upload Video' : 'Upload Document'}</Label>
                      <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground hover:bg-accent">
                        <Upload className="h-4 w-4" />
                        {headerMediaFile ? headerMediaFile.name : `Choose ${headerType.toLowerCase()} file`}
                        <input type="file" accept={headerType === 'IMAGE' ? 'image/*' : headerType === 'VIDEO' ? 'video/*' : '.pdf,.doc,.docx'} onChange={(e) => setHeaderMediaFile(e.target.files?.[0] || null)} className="hidden" />
                      </label>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5 border-t pt-4">
                  <Label className="text-xs font-medium">Body Text</Label>
                  <textarea value={bodyText} onChange={(e) => setBodyText(e.target.value.slice(0, 1024))}
                    className="flex min-h-[180px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono leading-relaxed"
                    placeholder="Hi {{1}}, your order {{2}} has been confirmed!" />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Use {'{{variable_name}}'} for placeholders</span>
                    <span>{bodyText.length}/1024</span>
                  </div>
                </div>

                {variables.length > 0 && (
                  <div className="space-y-2 border-t pt-4">
                    <Label className="text-xs font-medium">Variable Samples ({variables.length})</Label>
                    <p className="text-[10px] text-muted-foreground">Provide sample values to help Meta review your template.</p>
                    {variables.map((v) => (
                      <div key={v} className="grid grid-cols-3 gap-2 items-center">
                        <span className="text-xs font-mono text-muted-foreground">{`{{${v}}}`}</span>
                        <Input className="col-span-2" value={variableSamples[v] || ''} onChange={(e) => setVariableSamples({ ...variableSamples, [v]: e.target.value })} placeholder={`Sample for ${v}`} />
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-1.5 border-t pt-4">
                  <Label className="text-xs font-medium">Footer (optional, max 60 chars)</Label>
                  <Input value={footerText} onChange={(e) => setFooterText(e.target.value.slice(0, 60))} placeholder="Footer text" />
                  <p className="text-[10px] text-muted-foreground text-right">{footerText.length}/60</p>
                </div>

                <div className="space-y-3 border-t pt-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium">Buttons ({buttons.length})</Label>
                      <div className="flex gap-1 flex-wrap justify-end">
                        <Button variant="outline" size="sm" onClick={() => { const b: TemplateButton = { type: 'URL', text: '', url: '' }; setButtons([...buttons, b]); }}><PlusCircle className="h-3 w-3" /> Visit Website</Button>
                        <Button variant="outline" size="sm" onClick={() => { const b: TemplateButton = { type: 'PHONE_NUMBER', text: '', phone_number: '' }; setButtons([...buttons, b]); }}><PlusCircle className="h-3 w-3" /> Call Phone</Button>
                        <Button variant="outline" size="sm" onClick={() => { const b: TemplateButton = { type: 'QUICK_REPLY', text: '' }; setButtons([...buttons, b]); }}><PlusCircle className="h-3 w-3" /> Quick Reply</Button>
                        <Button variant="outline" size="sm" onClick={() => { const b: TemplateButton = { type: 'FLOW', text: '', flow_id: '' }; setButtons([...buttons, b]); }}><PlusCircle className="h-3 w-3" /> Complete Flow</Button>
                        <Button variant="outline" size="sm" onClick={() => { const b: TemplateButton = { type: 'COPY_CODE', text: '', copy_code: '' }; setButtons([...buttons, b]); }}><PlusCircle className="h-3 w-3" /> Copy Code</Button>
                      </div>
                    </div>
                    {buttons.map((btn, i) => (
                      <div key={i} className="rounded-lg border p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-muted-foreground uppercase">{btn.type.replace('_', ' ')}</span>
                          <Button variant="ghost" size="icon" onClick={() => setButtons(buttons.filter((_, idx) => idx !== i))}><XCircle className="h-4 w-4 text-destructive" /></Button>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <Input value={btn.text} onChange={(e) => setButtons(buttons.map((b, idx) => idx === i ? { ...b, text: e.target.value } : b))} placeholder="Button text" />
                          {btn.type === 'URL' && <Input value={btn.url || ''} onChange={(e) => setButtons(buttons.map((b, idx) => idx === i ? { ...b, url: e.target.value } : b))} placeholder="https://example.com" />}
                          {btn.type === 'PHONE_NUMBER' && <Input value={btn.phone_number || ''} onChange={(e) => setButtons(buttons.map((b, idx) => idx === i ? { ...b, phone_number: e.target.value } : b))} placeholder="+1234567890" />}
                          {btn.type === 'FLOW' && <Input value={btn.flow_id || ''} onChange={(e) => setButtons(buttons.map((b, idx) => idx === i ? { ...b, flow_id: e.target.value } : b))} placeholder="Flow ID" />}
                          {btn.type === 'COPY_CODE' && <Input value={btn.copy_code || ''} onChange={(e) => setButtons(buttons.map((b, idx) => idx === i ? { ...b, copy_code: e.target.value } : b))} placeholder="Code to copy" />}
                        </div>
                      </div>
                    ))}
                </div>

                <div className="flex justify-between gap-2 pt-2">
                  <Button variant="outline" onClick={() => setStep(0)}>Back</Button>
                  <Button onClick={handleNext}>Next</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 2 && (
            <Card>
              <CardContent className="pt-6 space-y-5">
                <div className="flex items-center gap-3 text-green-600 bg-green-50 rounded-lg p-4">
                  <CheckCircle2 className="h-6 w-6" />
                  <div>
                    <p className="font-medium text-sm">Ready to submit</p>
                    <p className="text-xs text-green-700">Review your template details before submitting to Meta.</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-muted-foreground text-xs">Name</span><p className="font-medium">{isEdit ? template?.name : name}</p></div>
                    <div><span className="text-muted-foreground text-xs">Category</span><p className="font-medium capitalize">{category.toLowerCase()}</p></div>
                    <div><span className="text-muted-foreground text-xs">Type</span><p className="font-medium">{TEMPLATE_TYPES.find((t) => t.id === templateType)?.label}</p></div>
                    <div><span className="text-muted-foreground text-xs">Language</span><p className="font-medium uppercase">{language}</p></div>
                  </div>
                  <div className="border-t pt-3">
                    <span className="text-muted-foreground text-xs">Header</span>
                    <p className="text-sm">{headerType === 'NONE' ? 'No header' : headerType === 'TEXT' ? headerText : `${headerType} media`}</p>
                  </div>
                  <div className="border-t pt-3">
                    <span className="text-muted-foreground text-xs">Body</span>
                    <p className="text-sm whitespace-pre-wrap">{bodyText.slice(0, 200)}{bodyText.length > 200 ? '...' : ''}</p>
                  </div>
                  {footerText && (
                    <div className="border-t pt-3">
                      <span className="text-muted-foreground text-xs">Footer</span>
                      <p className="text-sm">{footerText}</p>
                    </div>
                  )}
                  <div className="border-t pt-3">
                    <span className="text-muted-foreground text-xs">Buttons</span>
                    <p className="text-sm">{buttons.length === 0 ? 'None' : buttons.map((b) => b.text || `[${b.type}]`).join(', ')}</p>
                  </div>
                </div>

                <div className="flex justify-between gap-2 pt-2 border-t">
                  <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
                  <Button onClick={handleSave} disabled={saving}>
                    <Save className="h-4 w-4" /> {saving ? 'Submitting...' : isEdit ? 'Update in Meta' : 'Submit for review'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {step > 0 && preview}
      </div>
    </div>
  );
}
