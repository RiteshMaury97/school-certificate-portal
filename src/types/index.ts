export type Certificate = {
  certId: string;
  title: string;
  type: string;
  session: string;
  issueDate: string | null;
  certificateNumber: string;
  mimeType: string;
};
export type StudentResult = {
  studentName: string;
  session: string;
  accessToken: string;
  tokenExpiresIn: number;
  certificates: Certificate[];
};
export type ApiError = { error: string };
