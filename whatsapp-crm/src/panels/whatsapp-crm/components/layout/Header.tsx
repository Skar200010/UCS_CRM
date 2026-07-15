import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../lib/supabase';
import { Badge } from '../ui/Badge';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuDescription,
} from '../ui/DropdownMenu';
import { Settings, LogOut, ChevronDown, Phone } from 'lucide-react';

interface PhoneNumber {
  status: string;
  display_phone_number: string;
  quality_rating?: string;
}

const statusConfig: Record<string, { label: string; variant: 'success' | 'warning' | 'error' | 'neutral' }> = {
  verified: { label: 'Connected', variant: 'success' },
  pending: { label: 'Pending', variant: 'warning' },
  banned: { label: 'Banned', variant: 'error' },
  restricted: { label: 'Restricted', variant: 'error' },
};

function getInitials(first?: string, last?: string): string {
  if (first && last) return (first[0] + last[0]).toUpperCase();
  if (first) return first[0].toUpperCase();
  return '?';
}

export function Header() {
  const { user, signOut } = useAuthStore();
  const navigate = useNavigate();
  const [phoneNumber, setPhoneNumber] = useState<PhoneNumber | null>(null);

  useEffect(() => {
    (async () => {
      const { data: acct } = await supabase
        .from('whatsapp_accounts')
        .select('phone_number_id, access_token')
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!acct) return;
      try {
        const r = await fetch(`https://graph.facebook.com/v23.0/${acct.phone_number_id}?fields=display_phone_number,quality_rating,verified_name,code_verification_status`, {
          headers: { Authorization: `Bearer ${acct.access_token}` },
        });
        const data = await r.json();
        if (data.display_phone_number) {
          setPhoneNumber({ status: data.code_verification_status || 'verified', display_phone_number: data.display_phone_number, quality_rating: data.quality_rating });
        }
      } catch {}
    })();
  }, []);

  const config = phoneNumber ? statusConfig[phoneNumber.status] : null;

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <header className="relative flex h-16 items-center justify-between border-b bg-card px-6">
      <div className="flex items-center gap-3">
        {phoneNumber ? (
          <>
            <span
              className={`h-2 w-2 rounded-full ${
                config?.variant === 'success'
                  ? 'bg-green-500'
                  : config?.variant === 'warning'
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
              }`}
            />
            <span className="text-sm text-muted-foreground">
              {phoneNumber.display_phone_number}
            </span>
            <Badge variant={config?.variant || 'neutral'}>
              {config?.label || phoneNumber.status}
            </Badge>
            {phoneNumber.quality_rating && (
              <span
                className={`hidden h-2.5 w-2.5 rounded-full sm:inline-block ${
                  phoneNumber.quality_rating === 'GREEN'
                    ? 'bg-green-500'
                    : phoneNumber.quality_rating === 'YELLOW'
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                }`}
                title={`Quality: ${phoneNumber.quality_rating}`}
              />
            )}
          </>
        ) : (
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <Phone className="h-4 w-4" />
            No number connected
          </span>
        )}
      </div>

      <div className="relative flex items-center">
        <DropdownMenu>
          <DropdownMenuTrigger>
            <div className="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-accent">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                {getInitials(user?.first_name, user?.last_name)}
              </div>
              <span className="hidden text-sm font-medium sm:inline">
                {user?.first_name} {user?.last_name}
              </span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>
              {user?.first_name} {user?.last_name}
            </DropdownMenuLabel>
            <DropdownMenuDescription>{user?.email}</DropdownMenuDescription>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/settings')}>
              <Settings className="h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
