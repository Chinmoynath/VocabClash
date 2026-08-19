import React from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { AuthCard } from './AuthCard';

interface GoogleAuthCardProps {
  currentUser: FirebaseUser | null;
  isSyncing: boolean;
  onUserChange?: (user: FirebaseUser | null) => void;
  onManualSync?: () => void;
  onSignOut?: () => Promise<void>;
  onSuccessClose?: () => void;
}

export const GoogleAuthCard: React.FC<GoogleAuthCardProps> = (props) => {
  return <AuthCard {...props} />;
};

export { AuthCard };
