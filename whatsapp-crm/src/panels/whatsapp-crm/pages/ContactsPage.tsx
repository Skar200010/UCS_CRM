import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { ContactFormModal } from '../components/contacts/ContactFormModal';
import { ContactImportModal } from '../components/contacts/ContactImportModal';
import { Plus, Search, Users, UserPlus, Upload } from 'lucide-react';
import { useState } from 'react';
import type { Contact } from 'shared';

export function ContactsPage() {
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const queryClient = useQueryClient();

  const { data: contacts, isLoading } = useQuery({
    queryKey: ['contacts', search],
    queryFn: async () => {
      let query = supabase
        .from('contacts')
        .select('*')
        .order('created_at', { ascending: false });

      if (search) {
        query = query.or(
          `first_name.ilike.%${search}%,last_name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Contact[];
    },
  });

  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['contacts'] });
  };

  const handleEdit = (contact: Contact) => {
    setEditingContact(contact);
    setModalOpen(true);
  };

  const handleAdd = () => {
    setEditingContact(null);
    setModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Contacts</h1>
          <p className="text-muted-foreground">Manage your customer contacts</p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="h-4 w-4" />
          Add Contact
        </Button>
        <Button variant="outline" onClick={() => setImportOpen(true)}>
          <Upload className="h-4 w-4" />
          Import CSV
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search contacts..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="animate-pulse border-b pb-3">
                  <div className="mb-2 h-4 w-40 rounded bg-muted" />
                  <div className="h-3 w-28 rounded bg-muted" />
                </div>
              ))}
            </div>
          ) : contacts && contacts.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="pb-3 text-left text-sm font-medium text-muted-foreground">Name</th>
                    <th className="pb-3 text-left text-sm font-medium text-muted-foreground">Phone</th>
                    <th className="pb-3 text-left text-sm font-medium text-muted-foreground">Email</th>
                    <th className="pb-3 text-left text-sm font-medium text-muted-foreground">Source</th>
                    <th className="pb-3 text-left text-sm font-medium text-muted-foreground">Created</th>
                    <th className="pb-3 text-right text-sm font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((contact) => (
                    <tr key={contact.id} className="border-b transition-colors hover:bg-muted/50">
                      <td className="py-3">
                        <Link
                          to={`/contacts/${contact.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {contact.first_name} {contact.last_name}
                        </Link>
                      </td>
                      <td className="py-3 text-sm">{contact.phone}</td>
                      <td className="py-3 text-sm">{contact.email || '-'}</td>
                      <td className="py-3 text-sm capitalize">{contact.source}</td>
                      <td className="py-3 text-sm text-muted-foreground">
                        {new Date(contact.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(contact)}>
                          Edit
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
              <Users className="h-12 w-12" />
              <p className="text-lg font-medium">No contacts yet</p>
              <p className="text-sm">Contacts from WhatsApp conversations will appear here automatically</p>
              <Button variant="outline" onClick={handleAdd} className="mt-2">
                <UserPlus className="h-4 w-4" />
                Add your first contact
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <ContactFormModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingContact(null); }}
        onSuccess={handleSuccess}
        contact={editingContact}
      />

      <ContactImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
