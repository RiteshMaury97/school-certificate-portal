import type { Role } from "../../types/admin.types";
import type { Dispatch, SetStateAction } from "react";
type Api = <T extends Record<string, unknown> = Record<string, unknown>>(url:string,init?:RequestInit)=>Promise<T>;
type Props={role:Role;rights:Record<string,unknown>[];resolution:Record<string,string>;setResolution:Dispatch<SetStateAction<Record<string,string>>>;resolveRight:(id:string)=>Promise<void>;act:(fn:()=>Promise<void>)=>Promise<void>;api:Api;load:()=>Promise<void>;setToast:Dispatch<SetStateAction<string>>};
export default function RightsTab({role,rights,resolution,setResolution,resolveRight,act,api,load,setToast}:Props){
 return (
  <section className="rounded-xl border bg-[var(--surface)] p-5">
                <h2 className="text-lg font-bold">Student / parent data-rights requests</h2>
                <div className="mt-4 space-y-3">
                  {rights.map((r) => (
                    <article key={String(r.id)} className="rounded-lg border p-4">
                      <p className="font-semibold">
                        {String(r.requestType ?? r.type ?? "Request")} ·{" "}
                        {String(r.requesterName ?? r.name ?? "Requester")}
                      </p>
                      <p className="mt-1 text-sm text-[var(--text-muted)]">
                        {String(r.description ?? r.details ?? "")}
                      </p>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">
                        Ack: {String(r.acknowledgmentId ?? r.id)} · Contact:{" "}
                        {String(r.contactEmail ?? "No data found")} · Student:{" "}
                        {String(r.studentName ?? "")}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <input
                          translate="no"
                          value={resolution[String(r.id)] ?? ""}
                          onChange={(e) => { setResolution((v) => ({
                              ...v,
                              [String(r.id)]: e.target.value,
                            })); }
                          }
                          placeholder="Resolution notes"
                          className="min-w-60 flex-1 rounded border px-3 py-2"
                        />
                        <button
                          onClick={() => resolveRight(String(r.id))}
                          className="rounded bg-[var(--primary)] px-4 py-2 text-[var(--on-primary)]"
                        >
                          Resolve
                        </button>
                        {r.requestType === "erasure" && role === "superadmin" && (
                          <button
                            onClick={() => {
                              const studentId = prompt(
                                "Enter the verified Firestore student record ID:",
                              );
                              if (!studentId) return;
                              const confirmText = prompt(
                                "Type ERASE to permanently erase the verified student's data:",
                              );
                              if (confirmText !== "ERASE") return;
                              const reason = prompt(
                                "Record the verified data-principal request / legal basis (minimum 10 characters):",
                              );
                              if (!reason) return;
                              void act(async () => {
                                const result = await api<{
                                  acknowledgmentId: string;
                                  erasureId: string;
                                }>("/api/admin/rights", {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    id: String(r.id),
                                    studentId,
                                    action: "erase",
                                    confirm: "ERASE",
                                    reason,
                                  }),
                                });
                                setToast(
                                  `Erasure complete. Request acknowledgment: ${result.acknowledgmentId}; receipt: ${result.erasureId}`,
                                );
                                await load();
                              });
                            }}
                            className="rounded bg-[var(--primary)] px-4 py-2 text-[var(--on-primary)]"
                          >
                            Approve erasure
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
 );
}
