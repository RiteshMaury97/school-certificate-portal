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
  fatherName: string;
  motherName: string;
  className: string;
  scholarNumber: string;
  session: string;
  accessToken: string;
  tokenExpiresIn: number;
  certificates: Certificate[];
};
export type ApiError = { error: string };
