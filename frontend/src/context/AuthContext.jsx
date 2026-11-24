import React, { createContext, useCallback, useContext, useState, useEffect } from "react";
import { secretSantaService } from "../services/secretSantaService";
import { ADMIN_EMAIL } from "../config/participants";
import { auth, onAuthStateChanged, signOut as firebaseSignOut } from "../config/firebase";

const AuthContext = createContext(null);
const SELECTED_MEMBER_KEY = "SECRET_SANTA_SELECTED_MEMBER_ID";

function sessionUser(firebaseUser) {
  if (!firebaseUser?.emailVerified || !firebaseUser.email) return null;
  const email = firebaseUser.email.toLowerCase();
  return { uid: firebaseUser.uid, email, isAdmin: email === ADMIN_EMAIL };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [familyMembers, setFamilyMembers] = useState([]);
  const [selectedMember, setSelectedMemberState] = useState(null);
  const [loading, setLoading] = useState(Boolean(auth));

  // Set selected member and persist to localStorage
  const setSelectedMember = (member) => {
    setSelectedMemberState(member);
    if (member && member.id) {
      localStorage.setItem(SELECTED_MEMBER_KEY, member.id);
    } else {
      localStorage.removeItem(SELECTED_MEMBER_KEY);
    }
  };

  const loadFamily = useCallback(async (currentUser) => {
    const { familyMembers: members } = await secretSantaService.getMyFamilyAssignments(currentUser);
    if (auth?.currentUser?.uid !== currentUser.uid) return [];

    const savedMemberId = localStorage.getItem(SELECTED_MEMBER_KEY);
    const member = members.find((m) => m.id === savedMemberId) || members[0] || null;
    setFamilyMembers(members);
    setSelectedMemberState(member);
    if (member) localStorage.setItem(SELECTED_MEMBER_KEY, member.id);
    return members;
  }, []);

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, async (firebaseUser) => {
      const nextUser = sessionUser(firebaseUser);
      setUser(nextUser);
      if (!nextUser) {
        setFamilyMembers([]);
        setSelectedMemberState(null);
      } else {
        await loadFamily(nextUser).catch((err) => console.error("Failed to load family members:", err));
      }
      setLoading(false);
    });
  }, [loadFamily]);

  const loginWithEmailLink = useCallback(async (email, href) => {
    setLoading(true);
    try {
      const authedUser = sessionUser(await secretSantaService.completeEmailSignIn(email, href));
      if (!authedUser) throw new Error("A verified email is required.");
      setUser(authedUser);
      localStorage.removeItem("emailForSignIn");
      return authedUser;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = async () => {
    if (auth) {
      await firebaseSignOut(auth);
    }
    setUser(null);
    setFamilyMembers([]);
    setSelectedMemberState(null);
    localStorage.removeItem("SECRET_SANTA_AUTH_USER");
    localStorage.removeItem("emailForSignIn");
    localStorage.removeItem(SELECTED_MEMBER_KEY);
  };

  const refreshFamily = useCallback(() => user ? loadFamily(user) : Promise.resolve([]), [user, loadFamily]);

  return (
    <AuthContext.Provider
      value={{
        user,
        familyMembers,
        selectedMember,
        setSelectedMember,
        loading,
        loginWithEmailLink,
        logout,
        refreshFamily,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
