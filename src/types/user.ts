/**
 * @purpose Centralized type definitions for users, roles and profiles.
 * @dependencies Used by AuthContext, AdminDashboard, SpecialistStudents, Profiles.
 */

/** Application roles stored in user_roles table */
export type AppRole = "admin" | "nutricionista" | "personal" | "user" | "closer" | "cs";

/** Specialist specialty types (normalized) */
export type Specialty = "personal" | "nutricionista";

/** User profile status */
export type ProfileStatus = "pendente_onboarding" | "pendente" | "ativo" | "inativo" | "cancelado";

/** Minimal profile shape used across dashboards */
export interface ProfileSummary {
  id: string;
  nome: string | null;
  email: string | null;
  status: ProfileStatus;
  avatar_url?: string | null;
  created_at: string;
}

/** Presence state for a user */
export interface UserPresence {
  user_id: string;
  online: boolean;
  last_seen?: string;
}
