export function csrf() {
  return (
    document.cookie
      .split("; ")
      .find((x) => x.startsWith("sis_admin_csrf="))
      ?.split("=")[1] ?? ""
  );
}
