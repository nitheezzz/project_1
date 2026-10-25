import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type Profile = {
  username: string;
  name: string | null;
  bio: string | null;
  profileColor: string | null;
};

type Section = "profile" | "password";

export function ProfileDialog({
  open,
  onOpenChange,
  user,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: Profile;
}) {
  const utils = trpc.useUtils();
  const saveProfile = trpc.account.updateProfile.useMutation();
  const changePassword = trpc.account.changePassword.useMutation();
  const [section, setSection] = useState<Section>("profile");
  const [name, setName] = useState(user.name ?? user.username);
  const [bio, setBio] = useState(user.bio ?? "");
  const [profileColor, setProfileColor] = useState(user.profileColor ?? "sage");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setSection("profile");
      setName(user.name ?? user.username);
      setBio(user.bio ?? "");
      setProfileColor(user.profileColor ?? "sage");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setError("");
    }
  }, [open, user]);

  const submitProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    try {
      await saveProfile.mutateAsync({
        name: name.trim(),
        bio: bio.trim() || null,
        profileColor: profileColor as "sage" | "ocean" | "violet" | "amber",
      });
      await utils.account.me.invalidate();
      toast.success("Profile updated.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not update your profile."
      );
    }
  };

  const submitPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("The new passwords don’t match.");
      return;
    }
    if (newPassword === currentPassword) {
      setError("Choose a new password that differs from your current one.");
      return;
    }
    try {
      await changePassword.mutateAsync({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success(
        "Password changed. Use the new password next time you sign in."
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not change your password."
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dialog-panel profile-dialog">
        <DialogHeader>
          <DialogTitle>Account settings</DialogTitle>
          <DialogDescription>
            Personalize how your workspace looks and keep your sign-in secure.
          </DialogDescription>
        </DialogHeader>
        <div
          className="profile-tabs"
          role="tablist"
          aria-label="Account settings"
        >
          <button
            type="button"
            role="tab"
            aria-selected={section === "profile"}
            className={section === "profile" ? "active" : ""}
            onClick={() => {
              setSection("profile");
              setError("");
            }}
          >
            Profile
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={section === "password"}
            className={section === "password" ? "active" : ""}
            onClick={() => {
              setSection("password");
              setError("");
            }}
          >
            Change password
          </button>
        </div>
        {section === "profile" ? (
          <form className="form-stack" onSubmit={submitProfile}>
            <label className="field-label">
              Display name
              <input
                className="field-control"
                required
                minLength={1}
                maxLength={50}
                value={name}
                onChange={event => setName(event.target.value)}
              />
            </label>
            <label className="field-label">
              About you <span className="field-optional">Optional</span>
              <textarea
                className="field-control field-textarea profile-bio"
                maxLength={180}
                value={bio}
                onChange={event => setBio(event.target.value)}
                placeholder="A little about your study goals…"
              />
            </label>
            <fieldset className="profile-color-fieldset">
              <legend>Avatar color</legend>
              <div className="profile-color-options">
                {(["sage", "ocean", "violet", "amber"] as const).map(color => (
                  <button
                    key={color}
                    type="button"
                    className={`profile-color-swatch swatch-${color} ${profileColor === color ? "selected" : ""}`}
                    aria-label={`${color} avatar color`}
                    aria-pressed={profileColor === color}
                    onClick={() => setProfileColor(color)}
                  />
                ))}
              </div>
            </fieldset>
            <p className="profile-username">
              Username: <strong>{user.username}</strong> · used to sign in
            </p>
            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}
            <div className="dialog-actions">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
              <Button
                type="submit"
                disabled={saveProfile.isPending || !name.trim()}
                className="primary-button"
              >
                {saveProfile.isPending ? "Saving…" : "Save profile"}
              </Button>
            </div>
          </form>
        ) : (
          <form className="form-stack" onSubmit={submitPassword}>
            <label className="field-label">
              Current password
              <input
                className="field-control"
                type="password"
                required
                minLength={10}
                maxLength={128}
                autoComplete="current-password"
                value={currentPassword}
                onChange={event => setCurrentPassword(event.target.value)}
              />
            </label>
            <label className="field-label">
              New password
              <input
                className="field-control"
                type="password"
                required
                minLength={10}
                maxLength={128}
                autoComplete="new-password"
                value={newPassword}
                onChange={event => setNewPassword(event.target.value)}
              />
              <span className="field-hint">Use at least 10 characters.</span>
            </label>
            <label className="field-label">
              Confirm new password
              <input
                className="field-control"
                type="password"
                required
                minLength={10}
                maxLength={128}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={event => setConfirmPassword(event.target.value)}
              />
            </label>
            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}
            <div className="dialog-actions">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
              <Button
                type="submit"
                disabled={changePassword.isPending}
                className="primary-button"
              >
                {changePassword.isPending ? "Updating…" : "Change password"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
