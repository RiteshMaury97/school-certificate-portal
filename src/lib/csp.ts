/** Copy the request nonce onto dynamically inserted scripts so strict CSP accepts them. */
export function applyCspNonce(script: HTMLScriptElement): void {
  const nonce = document.querySelector<HTMLScriptElement>("script[nonce]")?.nonce;
  if (nonce) script.nonce = nonce;
}
