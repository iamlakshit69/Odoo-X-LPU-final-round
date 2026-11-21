import React from 'react';
import { useAuth } from '../../auth/AuthContext';

interface PermissionGateProps {
  permission: string;
  ownerMemberId?: string;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function PermissionGate({
  permission,
  ownerMemberId,
  fallback = null,
  children,
}: PermissionGateProps) {
  const { hasPermission } = useAuth();

  if (!hasPermission(permission, ownerMemberId ? { ownerMemberId } : undefined)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
