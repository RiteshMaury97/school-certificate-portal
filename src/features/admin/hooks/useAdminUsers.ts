import { useState, type FormEvent, type Dispatch, type SetStateAction } from "react";

import { appCheckHeaders } from "@/lib/firebase-client";

import { csrf } from "../utils/admin-helpers";

import type { AdminInviteProfile, AdminInviteRole } from "../types/admin-state.types";
type Api=<T extends Record<string,unknown>=Record<string,unknown>>(url:string,init?:RequestInit)=>Promise<T>;
type Props={api:Api;act:(fn:()=>Promise<void>)=>Promise<void>;setToast:Dispatch<SetStateAction<string>>;setError:Dispatch<SetStateAction<string>>;load:()=>Promise<void>};
export function useAdminUsers({api,act,setToast,setError,load}:Props){
 const [adminEmail,setAdminEmail]=useState("");
 const [inviteRole,setInviteRole]=useState<AdminInviteRole>("uploader");
 const [inviteProfile,setInviteProfile]=useState<AdminInviteProfile>({
  name:"",preferredName:"",staffId:"",gender:"",dateOfBirth:"",position:"",department:"",designation:"",campus:"",joiningDate:"",reportingManager:"",officeLocation:"",alternateEmail:"",primaryPhone:"",secondaryPhone:"",address:"",emergencyContactName:"",emergencyContactPhone:"",
 });
 async function createBackup() {
    await act(async () => {
      const d = await api<{ objectKey: string; size: number }>("/api/admin/backup", {
        method: "POST",
      });
      setToast(`Encrypted backup saved to private R2: ${d.objectKey}`);
    });
  }
  async function exportData(format: "json" | "csv") {
    const passphrase =
      prompt(
        "Optional export passphrase (minimum 12 characters). Leave blank to use the server encryption key.",
      ) ?? "";
    if (passphrase && passphrase.length < 12) {
      setError("Passphrase must be at least 12 characters.");
      return;
    }
    await act(async () => {
      const response = await fetch("/api/admin/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await appCheckHeaders()),
          "x-csrf-token": decodeURIComponent(csrf()),
        },
        body: JSON.stringify({ format, passphrase }),
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Encrypted export failed.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `school-portal-export-${format}.enc`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }
  async function changeRole(uid: string, role: AdminInviteRole) {
    await act(async () => {
      await api("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid, role }),
      });
      await load();
    });
  }
  async function deleteUser(uid: string) {
    await act(async () => {
      await api("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid }),
      });
      await load();
    });
  }
  async function invite(e: FormEvent) {
    e.preventDefault();
    await act(async () => {
      await api("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: adminEmail, role: inviteRole, profile: inviteProfile }),
      });
      setAdminEmail("");
      setInviteProfile({name:"",preferredName:"",staffId:"",gender:"",dateOfBirth:"",position:"",department:"",designation:"",campus:"",joiningDate:"",reportingManager:"",officeLocation:"",alternateEmail:"",primaryPhone:"",secondaryPhone:"",address:"",emergencyContactName:"",emergencyContactPhone:""});
      setToast(`Invitation sent to ${adminEmail}. The email contains a temporary password and email verification link. They must change the password before receiving administrator access.`);
      await load();
    });
  }
 return {adminEmail,setAdminEmail,inviteRole,setInviteRole,inviteProfile,setInviteProfile,createBackup,exportData,changeRole,deleteUser,invite};
}
