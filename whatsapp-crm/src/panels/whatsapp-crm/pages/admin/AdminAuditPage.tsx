import { Card, CardContent } from '../../components/ui/Card';
import { Shield } from 'lucide-react';

export function AdminAuditPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Audit Logs</h1>
        <p className="text-muted-foreground">Platform-wide audit trail</p>
      </div>

      <Card>
        <CardContent className="py-16">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Shield className="h-12 w-12" />
            <p className="text-lg font-medium">Audit Logging</p>
            <p className="text-center text-sm max-w-md">
              Audit logs capture all significant actions across the platform.
              Enable by running migration 004_analytics.sql.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
