# Personal data breach response plan

This operational checklist supports incident handling. It is not legal advice; the school’s privacy adviser should review decisions and communications.

## First hour

- [ ] **Contain:** disable exposed links or accounts, isolate affected systems, stop unintended sharing and preserve safe access for essential school operations.
- [ ] **Preserve logs:** retain relevant application, identity, email, storage and provider logs; record timestamps and custodians. Do not overwrite or delete evidence.
- [ ] **Assess:** establish what happened, when it occurred and was discovered, systems and data categories involved, approximate count, minors involvement, likely impact and whether access is continuing. Do not put affected people’s names or contact details in the register.
- [ ] **Record:** open a suspected incident entry, assign the incident lead and deputy, record decisions with timestamps, and start the deadline tracker.
- [ ] **Notify:** alert the designated school leadership and privacy adviser. Consider applicable statutory intimations without delay; the Rule 7 detailed Board information is tracked at 72 hours from awareness. The adviser must review the facts and wording.

## First 24 hours

- [ ] Confirm containment and check for persistence or further access.
- [ ] Preserve and review relevant logs; document scope, systems, categories and estimated counts.
- [ ] Rotate potentially exposed credentials and API keys; review connected services and revoke compromised tokens.
- [ ] Revoke active administrator sessions when compromise is possible; require re-authentication and inspect recent admin activity.
- [ ] Assign an incident lead, deputy and Grievance Officer; agree on a secure update cadence.
- [ ] Prepare notification drafts for adviser review and record notification dates or step-specific reasons why a notification is not required.

## Roles

- **Incident lead:** owns response coordination, register accuracy, scope assessment and decision log.
- **Deputy:** maintains continuity, evidence tracking and follow-up when the lead is unavailable.
- **Grievance Officer:** coordinates questions and approved communications with affected people.

## Contact list (replace placeholders before launch)

- Incident lead: `[name / work contact]`
- Deputy: `[name / work contact]`
- Grievance Officer: `[name / work contact]`
- School legal/privacy adviser: `[name / work contact]`
- Hosting and security providers: `[provider incident contact]`
- Data Protection Board channel: `[verify current official submission channel]`

## Credential and session response

1. Rotate exposed administrator passwords, SMTP app passwords, signing keys, API keys and storage credentials through the provider’s secure console.
2. Revoke old credentials and tokens after replacement; check dependent services and scheduled jobs.
3. Revoke administrator sessions from the admin security page when compromise is suspected, then verify access logs and require fresh sign-in/MFA.
4. Record completion time and responsible role without copying secret values into the incident record.

## Communication rules

- Use the approved contact channel and share only information needed by each recipient.
- Never include affected people’s names, phone numbers or email addresses in the breach register, reminder email, or broadly distributed incident updates.
- Do not speculate, assign blame, or promise legal outcomes. Distinguish confirmed facts from open questions.
- Notification drafts are editable copy-only text. The school’s legal/privacy adviser must review them; this system never sends statutory notices automatically.
- Keep internal updates factual, timestamped and access-restricted. Preserve the immutable timeline.
