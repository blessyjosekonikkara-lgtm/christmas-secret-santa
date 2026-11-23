import React, { createContext, useContext, useState, useEffect } from "react";
import { secretSantaService } from "../services/secretSantaService";
import { ADMIN_EMAIL } from "../config/participants";
import { auth, onAuthStateChanged, signOut as firebaseSignOut, isLiveFirebaseConfigured } from "../config/firebase";

const AuthContext = createContext(null);
const SELECTED_MEMBER_KEY = "SECRET_SANTA_SELECTED_MEMBER_ID";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [familyMembers, setFamilyMembers] = useState([]);
  const [selectedMember, setSelectedMemberState] = useState(null);
  const [loading, setLoading] = useState(true);

  // Set selected member and persist to localStorage
  const setSelectedMember = (member) => {
    setSelectedMemberState(member);
    if (member && member.id) {
      localStorage.setItem(SELECTED_MEMBER_KEY, member.id);
    } else {
      localStorage.removeItem(SELECTED_MEMBER_KEY);
    }
  };

  // Restore session from localStorage or Firebase
  useEffect(() => {
    if (isLiveFirebaseConfigured && auth) {
      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser && firebaseUser.email) {
          const authUser = {
            uid: firebaseUser.uid,
            email: firebaseUser.email.toLowerCase(),
            isAdmin: firebaseUser.email.toLowerCase() === ADMIN_EMAIL.toLowerCase(),
          };
          setUser(authUser);
          await loadFamily(authUser);
        } else {
          setUser(null);
          setFamilyMembers([]);
          setSelectedMemberState(null);
        }
        setLoading(false);
      });
      return () => unsubscribe();
    } else {
      // Local simulation session restoration
      const savedUserStr = localStorage.getItem("SECRET_SANTA_AUTH_USER");
      if (savedUserStr) {
        try {
          const savedUser = JSON.parse(savedUserStr);
          setUser(savedUser);
          loadFamily(savedUser);
        } catch (e) {
          localStorage.removeItem("SECRET_SANTA_AUTH_USER");
        }
      }
      setLoading(false);
    }
  }, []);

  const loadFamily = async (currentUser) => {
    if (!currentUser) return;
    try {
      const data = await secretSantaService.getMyFamilyAssignments(currentUser);
      const members = data.familyMembers || [];
      setFamilyMembers(members);

      if (members.length > 0) {
        const savedMemberId = localStorage.getItem(SELECTED_MEMBER_KEY);
        const matchSaved = savedMemberId ? members.find((m) => m.id === savedMemberId) : null;
        if (matchSaved) {
          setSelectedMemberState(matchSaved);
        } else {
          // Default to the first member and save
          setSelectedMemberState(members[0]);
          localStorage.setItem(SELECTED_MEMBER_KEY, members[0].id);
        }
      } else {
        setSelectedMemberState(null);
      }
    } catch (err) {
      console.error("Failed to load family members:", err);
    }
  };

  const loginWithEmailLink = async (email, href) => {
    setLoading(true);
    try {
      const { user: authedUser } = await secretSantaService.completeEmailSignIn(email, href);
      setUser(authedUser);
      localStorage.setItem("SECRET_SANTA_AUTH_USER", JSON.stringify(authedUser));
      await loadFamily(authedUser);
      return authedUser;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    if (isLiveFirebaseConfigured && auth) {
      await firebaseSignOut(auth);
    }
    setUser(null);
    setFamilyMembers([]);
    setSelectedMemberState(null);
    localStorage.removeItem("SECRET_SANTA_AUTH_USER");
    localStorage.removeItem("emailForSignIn");
    localStorage.removeItem(SELECTED_MEMBER_KEY);
  };

  const refreshFamily = async () => {
    if (user) {
      await loadFamily(user);
    }
  };

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
