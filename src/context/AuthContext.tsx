import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('AuthProvider: Setting up onAuthStateChanged...');
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('AuthProvider: Auth state changed. User:', firebaseUser?.email);
      
      // Clean up previous profile listener if it exists
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (firebaseUser) {
        setLoading(true);
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        
        // Use onSnapshot for real-time profile updates
        unsubscribeProfile = onSnapshot(userDocRef, async (snapshot) => {
          console.log('AuthProvider: Profile snapshot received.');
          
          if (snapshot.exists()) {
            const data = snapshot.data();
            console.log('AuthProvider: Profile found:', data);
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email!,
              ...data,
              allowedClients: data?.allowedClients || []
            } as User);
            setLoading(false);
          } else {
            // Auto-bootstrap profile if it's missing
            console.log('AuthProvider: User detected without profile. Bootstrapping default profile...');
            const isOwner = firebaseUser.email === 'natanvileladesouza@gmail.com';
            const defaultProfile = {
              name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Novo Usuário',
              email: firebaseUser.email,
              role: isOwner ? 'admin' : 'client',
              allowedClients: [],
              created_at: new Date().toISOString()
            };
            try {
              await setDoc(userDocRef, defaultProfile);
              // The next snapshot will handle setting the user state
            } catch (err) {
              console.error('AuthProvider: Error bootstrapping profile:', err);
              setUser(null);
              setLoading(false);
            }
          }
        }, (error) => {
          console.error('AuthProvider: Profile snapshot error:', error);
          setUser(null);
          setLoading(false);
        });
      } else {
        console.log('AuthProvider: No user authenticated.');
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  const signOut = () => auth.signOut();

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
